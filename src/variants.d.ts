import { Variants } from 'framer-motion';

declare module '../../variants.js' {
    export function slideFromRight(duration: number): Variants;
    export function slideFromLeft(duration: number): Variants;
}