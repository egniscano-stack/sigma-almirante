import { Taxpayer, TaxConfig } from '../types';
import taxStructure from '../../data/taxStructure.json';

/**
 * Calculates the monthly recurring rate for a taxpayer based on the assigned tax structure.
 * If no specific codes are assigned, it returns 0 (to avoid charging unassigned debts).
 */
export const calculateMonthlyRate = (tp: Taxpayer, config?: TaxConfig) => {
  let total = 0;
  let hasAssignment = false;

  // 1. Calculate from Selected Tax Codes (New Structure)
  if (tp.selectedTaxCodes && tp.selectedTaxCodes.length > 0) {
    hasAssignment = true;
    tp.selectedTaxCodes.forEach(code => {
      const structure = (taxStructure as any[]).find(s => s.code === code);
      if (structure) {
        const mRates = tp.magnitude === 'GRANDE' ? structure.rates.GRANDE :
                       tp.magnitude === 'MEDIANO' ? structure.rates.MEDIANO : 
                       structure.rates.PEQUENO;
        
        if (Array.isArray(mRates)) {
          total += tp.selectedRates?.[code] || mRates[0] || 0;
        } else if (typeof mRates === 'number') {
          total += mRates;
        }
      }
    });
  }

  // 2. Add Fixed Amounts (Explicitly assigned in edition)
  if ((tp.rotuloAmount || 0) > 0) {
    total += tp.rotuloAmount || 0;
    hasAssignment = true;
  }
  
  if ((tp.garbageAmount || 0) > 0) {
    total += tp.garbageAmount || 0;
    hasAssignment = true;
  }

  // 3. Fallback to old category logic ONLY IF explicitly assigned
  if (!hasAssignment && tp.commercialCategory && tp.commercialCategory !== 'NONE') {
    const rates = config?.commercialRates || {};
    total += rates[tp.commercialCategory as any] || config?.commercialBaseRate || 0;
  }

  return total;
};
