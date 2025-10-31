import { describe, it, expect } from 'vitest';
import {
    isSerializable,
    findNonSerializableValues,
    serializeDates,
    validateSerializable,
} from '../serialization';

describe('serialization utilities', () => {
    describe('isSerializable', () => {
        it('should return true for serializable values', () => {
            expect(isSerializable(null)).toBe(true);
            expect(isSerializable(undefined)).toBe(true);
            expect(isSerializable('string')).toBe(true);
            expect(isSerializable(123)).toBe(true);
            expect(isSerializable(true)).toBe(true);
            expect(isSerializable([])).toBe(true);
            expect(isSerializable({})).toBe(true);
        });

        it('should return false for non-serializable values', () => {
            expect(isSerializable(new Date())).toBe(false);
            expect(isSerializable([new Date()])).toBe(false);
            expect(isSerializable({ date: new Date() })).toBe(false);
        });
    });

    describe('findNonSerializableValues', () => {
        it('should find Date objects in nested structures', () => {
            const obj = {
                user: {
                    id: '123',
                    lastLogin: new Date(),
                },
                timestamps: [new Date(), new Date()],
            };

            const nonSerializable = findNonSerializableValues(obj);
            expect(nonSerializable).toContain('user.lastLogin');
            expect(nonSerializable).toContain('timestamps[0]');
            expect(nonSerializable).toContain('timestamps[1]');
        });

        it('should return empty array for serializable objects', () => {
            const obj = {
                user: {
                    id: '123',
                    lastLogin: '2023-01-01T00:00:00.000Z',
                },
                timestamps: ['2023-01-01T00:00:00.000Z'],
            };

            const nonSerializable = findNonSerializableValues(obj);
            expect(nonSerializable).toEqual([]);
        });
    });

    describe('serializeDates', () => {
        it('should convert Date objects to ISO strings', () => {
            const date = new Date('2023-01-01T00:00:00.000Z');
            const obj = {
                user: {
                    id: '123',
                    lastLogin: date,
                },
                timestamps: [date, date],
            };

            const serialized = serializeDates(obj);
            expect(serialized.user.lastLogin).toBe('2023-01-01T00:00:00.000Z');
            expect(serialized.timestamps[0]).toBe('2023-01-01T00:00:00.000Z');
            expect(serialized.timestamps[1]).toBe('2023-01-01T00:00:00.000Z');
        });

        it('should preserve non-Date values', () => {
            const obj = {
                id: '123',
                count: 456,
                active: true,
                data: null,
            };

            const serialized = serializeDates(obj);
            expect(serialized).toEqual(obj);
        });
    });

    describe('validateSerializable', () => {
        it('should not throw for serializable objects', () => {
            const obj = {
                id: '123',
                timestamp: '2023-01-01T00:00:00.000Z',
            };

            expect(() => validateSerializable(obj, 'test/action')).not.toThrow();
        });

        it('should warn for non-serializable objects', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const obj = {
                id: '123',
                timestamp: new Date(),
            };

            validateSerializable(obj, 'test/action');
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Non-serializable values found in action test/action:'),
                expect.any(String)
            );

            consoleSpy.mockRestore();
        });
    });
});