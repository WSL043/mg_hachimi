import { QAngle, Vector, Color } from "cs_script/point_script";

export class Vec implements Vector {
    constructor(
        public x: number,
        public y: number = 0,
        public z: number = 0,
    ) { }

    static from(input: QAngle | Color | Vector | number): Vec {
        if (typeof input === 'number') {
            return new Vec(input, input, input);
        }

        if ('pitch' in input && 'yaw' in input && 'roll' in input) {
            return new Vec(input.pitch, input.yaw, input.roll);
        }

        if ('x' in input && 'y' in input && 'z' in input) {
            return new Vec(input.x, input.y, input.z);
        }

        return new Vec(input.r / 255, input.g / 255, input.b / 255);
    }

    static zero() {
        return new Vec(0);
    }

    static one() {
        return new Vec(1);
    }

    add(other: Vector): Vec {
        const { x, y, z } = this;
        return new Vec(x + other.x, y + other.y, z + other.z);
    }

    sub(other: Vector): Vec {
        const { x, y, z } = this;
        return new Vec(x - other.x, y - other.y, z - other.z);
    }

    dot(other: Vector): number {
        const { x, y, z } = this;
        return x * other.x + y * other.y + z * other.z;
    }

    cross(right: Vector): Vec {
        const { x, y, z } = this;
        return new Vec(
            y * right.z - z * right.y,
            z * right.x - x * right.z,
            x * right.y - y * right.x,
        );
    }

    mul(factor: number): Vec {
        const { x, y, z } = this;
        return new Vec(
            x * factor,
            y * factor,
            z * factor,
        );
    }

    get length(): number {
        return Math.sqrt(this.dot(this));
    }

    toString(): string {
        return `${this.x} ${this.y} ${this.z}`;
    }
}

export class Ang implements QAngle {
    constructor(
        public pitch: number,
        public yaw: number,
        public roll: number,
    ) { }

    static from(vec: Vector): Ang {
        return new Ang(vec.x, vec.y, vec.z);
    }

    toString(): string {
        return `${this.pitch} ${this.yaw} ${this.roll}`;
    }
}

export class Col implements Color {
    constructor(
        public r: number,
        public g: number,
        public b: number,
        public a: number = 255,
    ) { }

    static from(input: Vector | string): Col {
        if (typeof input === 'string') {
            if (!input.startsWith('#') || ![4, 5, 7, 9].includes(input.length)) {
                throw new Error('invalid hex color string');
            }

            const hex = input.substring(1);
            if (hex.length < 6) {
                const [r, g, b, a] = Array.from(hex).map(v => parseInt(v + v, 16));
                return new Col(r!, g!, b!, a ?? 255);
            }

            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            const a = hex.length < 8 ? 255 : parseInt(hex.slice(6, 8), 16);
            return new Col(r, g, b, a);
        }

        return new Col(input.x * 255, input.y * 255, input.z * 255);
    }

    toHexString(): string {
        const r = this.r.toString(16).padStart(2, '0');
        const g = this.g.toString(16).padStart(2, '0');
        const b = this.b.toString(16).padStart(2, '0');
        const a = this.a.toString(16).padStart(2, '0');

        return `#${r}${g}${b}${this.a == 255 ? '' : a}`;
    }

    toString(): string {
        return `${this.r} ${this.g} ${this.b} ${this.a}`;
    }
}
