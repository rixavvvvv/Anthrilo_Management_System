import { describe, expect, it } from 'vitest';

import {
    getValidImportRows,
    validateFabricYarnImportRow,
} from './fabricYarnMaster.service';

describe('fabricYarnMaster.service', () => {
    it('validates required fields and numeric constraints', () => {
        const errors = validateFabricYarnImportRow(
            {
                yarn: '',
                yarnPercentage: 120,
                yarnPrice: -1,
                fabricType: '',
                print: '',
                fabricReadyTime: '',
            },
            2,
        );

        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.field === 'yarn')).toBe(true);
        expect(errors.some((e) => e.field === 'yarnPercentage')).toBe(true);
        expect(errors.some((e) => e.field === 'yarnPrice')).toBe(true);
    });

    it('filters only valid rows for import payload', () => {
        const validRows = getValidImportRows([
            {
                yarn: 'Cotton 40s',
                yarnPercentage: 60,
                yarnPrice: 320,
                fabricType: 'Cotton Knit',
                print: 'Solid',
                fabricReadyTime: '5 days',
                __rowNumber: 2,
                __isValid: true,
                __error: '',
            },
            {
                yarn: '',
                yarnPercentage: 0,
                yarnPrice: 0,
                fabricType: '',
                print: '',
                fabricReadyTime: '',
                __rowNumber: 3,
                __isValid: false,
                __error: 'Yarn is required',
            },
        ]);

        expect(validRows).toHaveLength(1);
        expect(validRows[0].yarn).toBe('Cotton 40s');
    });
});
