/**
 * Variant registry. Adding a variant: write one config file, add one line here.
 */
import type { AnyVariant } from '../engine/types.ts';
import { hongKong } from './hongkong.ts';
import { riichi } from './riichi.ts';

export const VARIANTS = [hongKong, riichi] as unknown as readonly AnyVariant[];
