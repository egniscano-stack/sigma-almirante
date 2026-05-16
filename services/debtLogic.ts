
import { Taxpayer, Transaction, TaxConfig, TaxType, CommercialCategory, TaxpayerType } from '../types';
import taxStructure from '../data/taxStructure.json';

export interface DebtItem {
  id: string;
  type: TaxType | 'DEUDA_ARRAS';
  label: string;
  amount: number;
  description: string;
  metadata?: any;
  isPriority?: boolean;
}

export const calculateTaxpayerDebt = (
  t: Taxpayer,
  transactions: Transaction[],
  config: TaxConfig
): { total: number; items: DebtItem[] } => {
  const debts: DebtItem[] = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // 1. Accumulated Debt (Previous Years / Manual Arrears)
  if ((t.previousYearsDebt || 0) > 0) {
    debts.push({
      id: 'previous-years',
      type: 'DEUDA_ARRAS',
      label: 'Deuda Acumulada (Periodos Anteriores)',
      amount: t.previousYearsDebt || 0,
      description: `Saldo pendiente de periodos anteriores`,
      isPriority: true
    });
  }

  // 2. Monthly Calculation (Commercial & Garbage)
  // We calculate from paymentStartDate or businessStartDate
  const refDateStr = t.paymentStartDate || t.businessStartDate;
  if (refDateStr) {
    const startDate = new Date(refDateStr + 'T00:00:00');
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;

    // Monthly Calculation (Commercial & Garbage) - SKIP for PLACA
    if (t.type !== TaxpayerType.PLACA) {
      // Iterate years from startYear to currentYear
      for (let year = startYear; year <= currentYear; year++) {
        const mStart = (year === startYear) ? startMonth : 1;
        const mEnd = (year === currentYear) ? currentMonth : 12;

        for (let m = mStart; m <= mEnd; m++) {
          const monthDate = new Date(year, m - 1);
          const monthName = monthDate.toLocaleString('es-ES', { month: 'long' });
          const labelSuffix = `${monthName} ${year}`;

          // Check if already paid
          const isPaid = (type: TaxType) => {
            return transactions.some(tx => {
              if (tx.taxpayerId !== t.id || tx.status !== 'PAGADO') return false;
              
              if (tx.metadata?.isConsolidated && tx.metadata?.originalItems) {
                const typeLabel = type === TaxType.COMERCIO ? 'Comercial' : 'Aseo';
                return tx.metadata.originalItems.some((i: any) => 
                  i.label.includes(typeLabel) && i.label.includes(labelSuffix)
                );
              }

              if (tx.taxType !== type) return false;
              if (tx.metadata?.month === m && tx.metadata?.year === year) return true;
              const typeDesc = type === TaxType.COMERCIO ? 'Impuesto Comercial' : 'Tasa de Aseo';
              return tx.description.includes(typeDesc) && tx.description.includes(labelSuffix);
            });
          };

          // Commercial Debt
          const hasCommFlag = t.hasCommercialActivity || (t.selectedTaxCodes && t.selectedTaxCodes.length > 0);
          if (hasCommFlag && t.status !== 'BLOQUEADO' && !isPaid(TaxType.COMERCIO)) {
            let commercialAmount = 0;
            let hasAssignment = false;

            if (t.selectedTaxCodes && t.selectedTaxCodes.length > 0) {
              hasAssignment = true;
              t.selectedTaxCodes.forEach(code => {
                const s = (taxStructure as any[]).find(st => st.code === code);
                if (s) {
                  const mRates = t.magnitude === 'GRANDE' ? s.rates.GRANDE :
                                 t.magnitude === 'MEDIANO' ? s.rates.MEDIANO : s.rates.PEQUENO;
                  if (Array.isArray(mRates)) {
                    commercialAmount += t.selectedRates?.[code] || mRates[0] || 0;
                  } else if (typeof mRates === 'number') {
                    commercialAmount += mRates;
                  }
                }
              });
            }

            if ((t.rotuloAmount || 0) > 0) {
              commercialAmount += t.rotuloAmount || 0;
              hasAssignment = true;
            }

            if (!hasAssignment && t.commercialCategory && t.commercialCategory !== 'NONE') {
              const rates = config?.commercialRates || {};
              const catRate = rates[t.commercialCategory as any];
              if (catRate !== undefined) {
                commercialAmount = catRate;
                hasAssignment = true;
              }
            }

            if (hasAssignment && commercialAmount > 0) {
              debts.push({
                id: `com-${m}-${year}`,
                type: TaxType.COMERCIO,
                label: `Impuesto Comercial - ${labelSuffix}`,
                amount: commercialAmount,
                description: `Mes de ${labelSuffix}`,
                metadata: { month: m, year }
              });
            }
          }

          // Garbage Debt
          if (t.hasGarbageService && t.status !== 'BLOQUEADO' && !isPaid(TaxType.BASURA)) {
            const garbageRate = t.garbageAmount || 0;
            if (garbageRate > 0) {
              debts.push({
                id: `bas-${m}-${year}`,
                type: TaxType.BASURA,
                label: `Tasa de Aseo - ${labelSuffix}`,
                amount: garbageRate,
                description: `Mes de ${labelSuffix}`,
                metadata: { month: m, year }
              });
            }
          }
        }
      }
    } else {
      // Yearly Logic for PLACA
      const renewalMonth = startMonth; // Monthly according to inscription month

      for (let year = startYear; year <= currentYear; year++) {
        // If it's the current year, check if renewal month has passed
        if (year === currentYear && currentMonth < renewalMonth) continue;

        const labelSuffix = `${year}`;
        
        const isPaid = transactions.some(tx => {
          if (tx.taxpayerId !== t.id || tx.status !== 'PAGADO') return false;
          if (tx.taxType !== TaxType.VEHICULO) return false;
          return tx.metadata?.year === year || tx.description.includes(labelSuffix);
        });

        if (!isPaid) {
          const amount = t.yearlyAmount || config?.plateCost || 0;
          if (amount > 0) {
            debts.push({
              id: `placa-yearly-${year}`,
              type: TaxType.VEHICULO,
              label: `Impuesto de Placa Anual - ${year}`,
              amount: amount,
              description: `Anualidad correspondiente al año ${year}`,
              metadata: { year, month: renewalMonth }
            });
          }
        }
      }
    }
  }

  // 3. Vehicles (Annual)
  if (t.vehicles && t.vehicles.length > 0 && t.status !== 'BLOQUEADO') {
    t.vehicles.forEach(v => {
      const lastDigit = parseInt(v.plate.slice(-1)) || 1;
      const renewalMonth = lastDigit === 0 ? 10 : lastDigit;

      // Only if renewal month reached/passed
      if (currentMonth >= renewalMonth) {
        const hasPaid = transactions.some(tx => {
          if (tx.taxpayerId !== t.id || tx.status !== 'PAGADO') return false;
          
          if (tx.metadata?.isConsolidated && tx.metadata?.originalItems) {
            return tx.metadata.originalItems.some((i: any) => i.label.includes(`Placa ${v.plate}`));
          }

          return tx.taxType === TaxType.VEHICULO &&
                 (tx.metadata?.plateNumber === v.plate || tx.description.includes(v.plate)) &&
                 new Date(tx.date).getFullYear() === currentYear;
        });

        if (!hasPaid) {
          const amount = config?.plateCost || 0;
          if (amount > 0) {
            debts.push({
              id: `veh-${v.plate}-${currentYear}`,
              type: TaxType.VEHICULO,
              label: `Impuesto Vehicular (Placa ${v.plate})`,
              amount: amount,
              description: `Impuesto de Circulación - Placa ${v.plate}`,
              metadata: { plateNumber: v.plate, year: currentYear, month: renewalMonth }
            });
          }
        }
      }
    });
  }

  return {
    total: debts.reduce((sum, item) => sum + item.amount, 0),
    items: debts
  };
};
