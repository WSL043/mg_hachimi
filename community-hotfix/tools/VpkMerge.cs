using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace MgHachimiHotfix
{
    public sealed class VpkMergeResult
    {
        public int EntryCount { get; internal set; }
        public long DataBytes { get; internal set; }
        public long OutputBytes { get; internal set; }
    }

    public sealed class VpkExtractResult
    {
        public int EntryCount { get; internal set; }
        public long DataBytes { get; internal set; }
    }

    public static class VpkMerger
    {
        private const uint Magic = 0x55AA1234;
        private const ushort EmbeddedArchiveIndex = 0x7FFF;

        public static VpkExtractResult Extract(string directoryVpkPath, string chunkDirectory, string sourcePrefix, string outputDirectory)
        {
            byte[] tree;
            using (var input = File.OpenRead(directoryVpkPath))
            using (var reader = new BinaryReader(input, Encoding.UTF8, false))
            {
                if (reader.ReadUInt32() != Magic)
                {
                    throw new InvalidDataException("Invalid VPK signature.");
                }
                if (reader.ReadUInt32() != 2)
                {
                    throw new InvalidDataException("Only VPK version 2 is supported.");
                }

                uint treeSize = reader.ReadUInt32();
                uint embeddedDataSize = reader.ReadUInt32();
                reader.ReadUInt32(); // Archive MD5 section size.
                reader.ReadUInt32(); // Other MD5 section size.
                reader.ReadUInt32(); // Signature section size.

                if (embeddedDataSize != 0)
                {
                    throw new InvalidDataException("Expected a split Workshop VPK with no embedded data.");
                }
                if (treeSize > int.MaxValue)
                {
                    throw new InvalidDataException("VPK tree is too large.");
                }

                tree = reader.ReadBytes((int)treeSize);
                if (tree.Length != (int)treeSize)
                {
                    throw new EndOfStreamException("VPK tree is truncated.");
                }
            }

            var chunks = FindChunks(chunkDirectory, sourcePrefix);
            if (chunks.Count == 0)
            {
                throw new InvalidDataException("No VPK chunks were found.");
            }

            var chunksByIndex = new Dictionary<ushort, Chunk>();
            foreach (var chunk in chunks)
            {
                chunksByIndex.Add(chunk.Index, chunk);
            }

            string outputRoot = Path.GetFullPath(outputDirectory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            Directory.CreateDirectory(outputRoot);
            string outputRootPrefix = outputRoot + Path.DirectorySeparatorChar;
            var openChunks = new Dictionary<ushort, FileStream>();
            var extractedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            int entryCount = 0;
            long dataBytes = 0;
            int position = 0;

            try
            {
                string extension;
                while ((extension = ReadCString(tree, ref position)).Length != 0)
                {
                    string directory;
                    while ((directory = ReadCString(tree, ref position)).Length != 0)
                    {
                        string fileName;
                        while ((fileName = ReadCString(tree, ref position)).Length != 0)
                        {
                            Require(tree, position, 18);
                            position += 4; // CRC32.
                            ushort preloadBytes = ReadUInt16(tree, ref position);
                            ushort archiveIndex = ReadUInt16(tree, ref position);
                            uint entryOffset = ReadUInt32(tree, ref position);
                            uint entryLength = ReadUInt32(tree, ref position);
                            ushort terminator = ReadUInt16(tree, ref position);
                            if (terminator != ushort.MaxValue)
                            {
                                throw new InvalidDataException("Invalid VPK entry terminator.");
                            }
                            Require(tree, position, preloadBytes);

                            if (archiveIndex == EmbeddedArchiveIndex)
                            {
                                throw new InvalidDataException("Unexpected embedded VPK entry.");
                            }

                            Chunk chunk;
                            if (!chunksByIndex.TryGetValue(archiveIndex, out chunk))
                            {
                                throw new InvalidDataException("VPK entry references missing chunk " + archiveIndex + ".");
                            }
                            if ((long)entryOffset + entryLength > chunk.Length)
                            {
                                throw new InvalidDataException("VPK entry exceeds chunk " + archiveIndex + ".");
                            }

                            string leafName = extension == " " ? fileName : fileName + "." + extension;
                            string relativePath = directory == " " ? leafName : Path.Combine(directory.Replace('/', Path.DirectorySeparatorChar), leafName);
                            string outputPath = Path.GetFullPath(Path.Combine(outputRoot, relativePath));
                            if (!outputPath.StartsWith(outputRootPrefix, StringComparison.OrdinalIgnoreCase))
                            {
                                throw new InvalidDataException("Unsafe VPK path rejected: " + relativePath);
                            }
                            if (!extractedPaths.Add(outputPath))
                            {
                                throw new InvalidDataException("Duplicate VPK path rejected: " + relativePath);
                            }

                            string outputParent = Path.GetDirectoryName(outputPath);
                            if (string.IsNullOrEmpty(outputParent))
                            {
                                throw new InvalidDataException("VPK entry has no output directory: " + relativePath);
                            }
                            Directory.CreateDirectory(outputParent);

                            FileStream chunkStream;
                            if (!openChunks.TryGetValue(archiveIndex, out chunkStream))
                            {
                                chunkStream = File.OpenRead(chunk.Path);
                                openChunks.Add(archiveIndex, chunkStream);
                            }
                            chunkStream.Position = entryOffset;

                            using (var output = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write, FileShare.Read))
                            {
                                output.Write(tree, position, preloadBytes);
                                CopyExact(chunkStream, output, entryLength);
                            }

                            position += preloadBytes;
                            entryCount++;
                            dataBytes += preloadBytes + (long)entryLength;
                        }
                    }
                }
            }
            finally
            {
                foreach (var stream in openChunks.Values)
                {
                    stream.Dispose();
                }
            }

            if (position != tree.Length)
            {
                throw new InvalidDataException("VPK tree has trailing or unparsed bytes.");
            }

            return new VpkExtractResult
            {
                EntryCount = entryCount,
                DataBytes = dataBytes
            };
        }

        public static VpkMergeResult Merge(string directoryVpkPath, string chunkDirectory, string sourcePrefix, string outputPath)
        {
            if (File.Exists(outputPath))
            {
                throw new IOException("Output VPK already exists: " + outputPath);
            }

            byte[] tree;
            uint treeSize;
            using (var input = File.OpenRead(directoryVpkPath))
            using (var reader = new BinaryReader(input, Encoding.UTF8, false))
            {
                if (reader.ReadUInt32() != Magic)
                {
                    throw new InvalidDataException("Invalid VPK signature.");
                }
                if (reader.ReadUInt32() != 2)
                {
                    throw new InvalidDataException("Only VPK version 2 is supported.");
                }

                treeSize = reader.ReadUInt32();
                uint embeddedDataSize = reader.ReadUInt32();
                reader.ReadUInt32(); // Archive MD5 section size.
                reader.ReadUInt32(); // Other MD5 section size.
                reader.ReadUInt32(); // Signature section size.

                if (embeddedDataSize != 0)
                {
                    throw new InvalidDataException("Expected a split Workshop VPK with no embedded data.");
                }
                if (treeSize > int.MaxValue)
                {
                    throw new InvalidDataException("VPK tree is too large.");
                }

                tree = reader.ReadBytes((int)treeSize);
                if (tree.Length != (int)treeSize)
                {
                    throw new EndOfStreamException("VPK tree is truncated.");
                }
            }

            var chunks = FindChunks(chunkDirectory, sourcePrefix);
            if (chunks.Count == 0)
            {
                throw new InvalidDataException("No VPK chunks were found.");
            }

            var chunkOffsets = new Dictionary<ushort, uint>();
            var chunkLengths = new Dictionary<ushort, long>();
            long totalDataBytes = 0;
            foreach (var chunk in chunks)
            {
                if (totalDataBytes > uint.MaxValue)
                {
                    throw new InvalidDataException("Merged VPK exceeds the version 2 size limit.");
                }
                chunkOffsets.Add(chunk.Index, (uint)totalDataBytes);
                chunkLengths.Add(chunk.Index, chunk.Length);
                totalDataBytes += chunk.Length;
            }
            if (totalDataBytes > uint.MaxValue)
            {
                throw new InvalidDataException("Merged VPK exceeds the version 2 size limit.");
            }

            int entryCount = RewriteTree(tree, chunkOffsets, chunkLengths);
            byte[] treeHash;
            byte[] emptyArchiveHash;
            using (var md5 = MD5.Create())
            {
                treeHash = md5.ComputeHash(tree);
                emptyArchiveHash = md5.ComputeHash(new byte[0]);
            }

            try
            {
                using (var output = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write, FileShare.Read))
                using (var writer = new BinaryWriter(output, Encoding.UTF8, false))
                {
                    writer.Write(Magic);
                    writer.Write((uint)2);
                    writer.Write(treeSize);
                    writer.Write((uint)totalDataBytes);
                    writer.Write((uint)0);  // Archive MD5 section size.
                    writer.Write((uint)48); // Other MD5 section size.
                    writer.Write((uint)20); // Source 2 empty signature header.
                    writer.Write(tree);

                    var buffer = new byte[1024 * 1024];
                    foreach (var chunk in chunks)
                    {
                        using (var input = File.OpenRead(chunk.Path))
                        {
                            int read;
                            while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                            {
                                output.Write(buffer, 0, read);
                            }
                        }
                    }

                    writer.Write(treeHash);
                    writer.Write(emptyArchiveHash);
                }

                byte[] fullHash;
                using (var input = File.OpenRead(outputPath))
                using (var md5 = MD5.Create())
                {
                    fullHash = md5.ComputeHash(input);
                }
                using (var output = new FileStream(outputPath, FileMode.Append, FileAccess.Write, FileShare.Read))
                using (var writer = new BinaryWriter(output, Encoding.UTF8, false))
                {
                    writer.Write(fullHash);
                    writer.Write(Magic);
                    writer.Write((uint)1);
                    writer.Write((uint)0);
                    writer.Write((uint)0);
                    writer.Write((uint)0);
                }

                Verify(outputPath);
                return new VpkMergeResult
                {
                    EntryCount = entryCount,
                    DataBytes = totalDataBytes,
                    OutputBytes = new FileInfo(outputPath).Length
                };
            }
            catch
            {
                if (File.Exists(outputPath))
                {
                    File.Delete(outputPath);
                }
                throw;
            }
        }

        public static void Verify(string vpkPath)
        {
            uint treeSize;
            uint dataSize;
            byte[] tree;
            byte[] storedTreeHash;
            byte[] storedArchiveHash;
            byte[] storedFullHash;

            using (var input = File.OpenRead(vpkPath))
            using (var reader = new BinaryReader(input, Encoding.UTF8, false))
            {
                if (reader.ReadUInt32() != Magic || reader.ReadUInt32() != 2)
                {
                    throw new InvalidDataException("Merged VPK header is invalid.");
                }
                treeSize = reader.ReadUInt32();
                dataSize = reader.ReadUInt32();
                if (reader.ReadUInt32() != 0 || reader.ReadUInt32() != 48 || reader.ReadUInt32() != 20)
                {
                    throw new InvalidDataException("Merged VPK section sizes are invalid.");
                }
                tree = reader.ReadBytes((int)treeSize);
                input.Position += dataSize;
                storedTreeHash = reader.ReadBytes(16);
                storedArchiveHash = reader.ReadBytes(16);
                storedFullHash = reader.ReadBytes(16);
                if (reader.ReadUInt32() != Magic || reader.ReadUInt32() != 1 || reader.ReadUInt32() != 0 || reader.ReadUInt32() != 0 || reader.ReadUInt32() != 0)
                {
                    throw new InvalidDataException("Merged VPK Source 2 signature header is invalid.");
                }
                if (input.Position != input.Length)
                {
                    throw new InvalidDataException("Merged VPK length is invalid.");
                }
            }

            byte[] expectedTreeHash;
            byte[] expectedEmptyHash;
            using (var md5 = MD5.Create())
            {
                expectedTreeHash = md5.ComputeHash(tree);
                expectedEmptyHash = md5.ComputeHash(new byte[0]);
            }
            if (!Equal(expectedTreeHash, storedTreeHash) || !Equal(expectedEmptyHash, storedArchiveHash))
            {
                throw new InvalidDataException("Merged VPK section checksum failed.");
            }

            byte[] expectedFullHash;
            using (var input = File.OpenRead(vpkPath))
            using (var md5 = MD5.Create())
            {
                expectedFullHash = ComputePrefixHash(md5, input, input.Length - 36);
            }
            if (!Equal(expectedFullHash, storedFullHash))
            {
                throw new InvalidDataException("Merged VPK full checksum failed.");
            }
        }

        private static int RewriteTree(byte[] tree, IDictionary<ushort, uint> chunkOffsets, IDictionary<ushort, long> chunkLengths)
        {
            int position = 0;
            int entryCount = 0;
            while (ReadCStringLength(tree, ref position) != 0)
            {
                while (ReadCStringLength(tree, ref position) != 0)
                {
                    while (ReadCStringLength(tree, ref position) != 0)
                    {
                        Require(tree, position, 18);
                        position += 4; // CRC32.
                        ushort preloadBytes = ReadUInt16(tree, ref position);
                        int archiveIndexPosition = position;
                        ushort archiveIndex = ReadUInt16(tree, ref position);
                        int entryOffsetPosition = position;
                        uint entryOffset = ReadUInt32(tree, ref position);
                        uint entryLength = ReadUInt32(tree, ref position);
                        ushort terminator = ReadUInt16(tree, ref position);
                        if (terminator != ushort.MaxValue)
                        {
                            throw new InvalidDataException("Invalid VPK entry terminator.");
                        }
                        Require(tree, position, preloadBytes);
                        position += preloadBytes;

                        uint baseOffset;
                        long chunkLength;
                        if (!chunkOffsets.TryGetValue(archiveIndex, out baseOffset) || !chunkLengths.TryGetValue(archiveIndex, out chunkLength))
                        {
                            throw new InvalidDataException("VPK entry references missing chunk " + archiveIndex + ".");
                        }
                        if ((long)entryOffset + entryLength > chunkLength)
                        {
                            throw new InvalidDataException("VPK entry exceeds chunk " + archiveIndex + ".");
                        }
                        ulong mergedOffset = (ulong)baseOffset + entryOffset;
                        if (mergedOffset > uint.MaxValue)
                        {
                            throw new InvalidDataException("Merged VPK entry offset overflow.");
                        }

                        WriteUInt16(tree, archiveIndexPosition, EmbeddedArchiveIndex);
                        WriteUInt32(tree, entryOffsetPosition, (uint)mergedOffset);
                        entryCount++;
                    }
                }
            }
            if (position != tree.Length)
            {
                throw new InvalidDataException("VPK tree has trailing or unparsed bytes.");
            }
            return entryCount;
        }

        private static List<Chunk> FindChunks(string directory, string sourcePrefix)
        {
            var result = new List<Chunk>();
            var expression = new Regex("^" + Regex.Escape(sourcePrefix) + "_(\\d{3})\\.vpk$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            foreach (string path in Directory.GetFiles(directory, sourcePrefix + "_*.vpk", SearchOption.TopDirectoryOnly))
            {
                Match match = expression.Match(Path.GetFileName(path));
                if (!match.Success)
                {
                    continue;
                }
                ushort index = ushort.Parse(match.Groups[1].Value);
                result.Add(new Chunk { Index = index, Path = path, Length = new FileInfo(path).Length });
            }
            result.Sort(delegate(Chunk left, Chunk right) { return left.Index.CompareTo(right.Index); });
            return result;
        }

        private static int ReadCStringLength(byte[] data, ref int position)
        {
            int start = position;
            while (position < data.Length && data[position] != 0)
            {
                position++;
            }
            if (position >= data.Length)
            {
                throw new EndOfStreamException("Unterminated VPK tree string.");
            }
            int length = position - start;
            position++;
            return length;
        }

        private static string ReadCString(byte[] data, ref int position)
        {
            int start = position;
            int length = ReadCStringLength(data, ref position);
            return Encoding.UTF8.GetString(data, start, length);
        }

        private static ushort ReadUInt16(byte[] data, ref int position)
        {
            Require(data, position, 2);
            ushort value = (ushort)(data[position] | (data[position + 1] << 8));
            position += 2;
            return value;
        }

        private static uint ReadUInt32(byte[] data, ref int position)
        {
            Require(data, position, 4);
            uint value = (uint)(data[position] | (data[position + 1] << 8) | (data[position + 2] << 16) | (data[position + 3] << 24));
            position += 4;
            return value;
        }

        private static void WriteUInt16(byte[] data, int position, ushort value)
        {
            data[position] = (byte)value;
            data[position + 1] = (byte)(value >> 8);
        }

        private static void WriteUInt32(byte[] data, int position, uint value)
        {
            data[position] = (byte)value;
            data[position + 1] = (byte)(value >> 8);
            data[position + 2] = (byte)(value >> 16);
            data[position + 3] = (byte)(value >> 24);
        }

        private static void Require(byte[] data, int position, int count)
        {
            if (position < 0 || count < 0 || position + count > data.Length)
            {
                throw new EndOfStreamException("VPK tree is truncated.");
            }
        }

        private static void CopyExact(Stream input, Stream output, uint count)
        {
            byte[] buffer = new byte[1024 * 1024];
            long remaining = count;
            while (remaining > 0)
            {
                int requested = (int)Math.Min(buffer.Length, remaining);
                int read = input.Read(buffer, 0, requested);
                if (read <= 0)
                {
                    throw new EndOfStreamException("VPK chunk ended before the entry boundary.");
                }
                output.Write(buffer, 0, read);
                remaining -= read;
            }
        }

        private static byte[] ComputePrefixHash(HashAlgorithm hash, Stream input, long count)
        {
            byte[] buffer = new byte[1024 * 1024];
            long remaining = count;
            while (remaining > 0)
            {
                int requested = (int)Math.Min(buffer.Length, remaining);
                int read = input.Read(buffer, 0, requested);
                if (read <= 0)
                {
                    throw new EndOfStreamException("VPK ended before checksum boundary.");
                }
                remaining -= read;
                if (remaining == 0)
                {
                    hash.TransformFinalBlock(buffer, 0, read);
                }
                else
                {
                    hash.TransformBlock(buffer, 0, read, null, 0);
                }
            }
            return hash.Hash;
        }

        private static bool Equal(byte[] left, byte[] right)
        {
            if (left == null || right == null || left.Length != right.Length)
            {
                return false;
            }
            int difference = 0;
            for (int i = 0; i < left.Length; i++)
            {
                difference |= left[i] ^ right[i];
            }
            return difference == 0;
        }

        private sealed class Chunk
        {
            public ushort Index;
            public string Path;
            public long Length;
        }
    }
}
