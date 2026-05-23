
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
  isPastDue?: boolean;
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

  // Parse lastPaymentMonth if set
  let lpYear = 0;
  let lpMonth = 0;
  if (t.lastPaymentMonth) {
    const parts = t.lastPaymentMonth.split('-');
    if (parts.length === 2) {
      lpYear = parseInt(parts[0]) || 0;
      lpMonth = parseInt(parts[1]) || 0;
    }
  }

  // Parse arrangement if active to prevent double-billing consolidated debts
  let arrYear = 0;
  let arrMonth = 0;
  if (t.paymentArrangement && t.paymentArrangement.estado === 'ACTIVO') {
    const arrDateParts = t.paymentArrangement.fechaCreacion.split('-');
    if (arrDateParts.length >= 2) {
      arrYear = parseInt(arrDateParts[0]) || 0;
      arrMonth = parseInt(arrDateParts[1]) || 0;
    }
  }

  // 1. Accumulated Debt (Previous Years / Manual Arrears)
  if ((t.previousYearsDebt || 0) > 0 && arrYear === 0) {
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

          // Check if paid by lastPaymentMonth configuration
          let isPaidByLastPayment = false;
          if (lpYear > 0 && lpMonth > 0) {
            if (year < lpYear || (year === lpYear && m <= lpMonth)) {
              isPaidByLastPayment = true;
            }
          }

          // Check if already paid
          const isPaid = (type: TaxType) => {
            if (isPaidByLastPayment) return true;
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

          // Check if consolidated by active arrangement
          const isConsolidated = arrYear > 0 && arrMonth > 0 && (year < arrYear || (year === arrYear && m <= arrMonth));

          // Commercial Debt
          const hasCommFlag = t.hasCommercialActivity || (t.selectedTaxCodes && t.selectedTaxCodes.length > 0);
          if (!isConsolidated && hasCommFlag && t.status !== 'BLOQUEADO' && !isPaid(TaxType.COMERCIO)) {
            let commercialAmount = 0;
            let hasAssignment = false;

            if (t.selectedTaxCodes && t.selectedTaxCodes.length > 0) {
              hasAssignment = true;
              t.selectedTaxCodes.forEach(code => {
                const s = (taxStructure as any[]).find(st => st.code === code);
                if (s) {
                  const mRates = t.magnitude === 'GRANDE' ? s.rates.GRANDE :
                                 t.magnitude === 'MEDIANO' ? s.rates.MEDIANO : s.rates.PEQUENO;
                  const customRate = typeof t.selectedRates?.[code] === 'number' ? t.selectedRates[code] : parseFloat(t.selectedRates?.[code] as any);
                  if (!isNaN(customRate)) {
                    commercialAmount += customRate;
                  } else if (Array.isArray(mRates)) {
                    commercialAmount += mRates[0] || 0;
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
          if (!isConsolidated && t.hasGarbageService && t.status !== 'BLOQUEADO' && !isPaid(TaxType.BASURA)) {
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
        
        let isPaidByLastPayment = false;
        if (lpYear > 0 && lpYear >= year) {
          isPaidByLastPayment = true;
        }

        const isPaid = isPaidByLastPayment || transactions.some(tx => {
          if (tx.taxpayerId !== t.id || tx.status !== 'PAGADO') return false;
          if (tx.taxType !== TaxType.VEHICULO) return false;
          return tx.metadata?.year === year || tx.description.includes(labelSuffix);
        });

        const isVehConsolidated = arrYear > 0 && year <= arrYear;

        if (!isVehConsolidated && !isPaid) {
          const amount = t.yearlyAmount || config?.plateCost || 0;
          if (amount > 0) {
            const plateNum = t.vehicles?.[0]?.plate || '';
            debts.push({
              id: `placa-yearly-${year}`,
              type: TaxType.VEHICULO,
              label: `Impuesto Vehicular ${plateNum ? `(Placa ${plateNum}) ` : ''}- ${year}`,
              amount: amount,
              description: `Anualidad correspondiente al año ${year}`,
              metadata: { year, month: renewalMonth, plateNumber: plateNum }
            });
          }
        }
      }
    }
  }

  // 3. Vehicles (Annual) - SKIP for PLACA to prevent double billing (already calculated in Section 2)
  if (t.type !== TaxpayerType.PLACA && t.vehicles && t.vehicles.length > 0 && t.status !== 'BLOQUEADO') {
    t.vehicles.forEach(v => {
      const lastDigit = parseInt(v.plate.slice(-1)) || 1;
      const renewalMonth = lastDigit === 0 ? 10 : lastDigit;

      // Only if renewal month reached/passed
      if (currentMonth >= renewalMonth) {
        let isPaidByLastPayment = false;
        if (lpYear > 0 && lpYear >= currentYear) {
          isPaidByLastPayment = true;
        }

        const hasPaid = isPaidByLastPayment || transactions.some(tx => {
          if (tx.taxpayerId !== t.id || tx.status !== 'PAGADO') return false;
          
          if (tx.metadata?.isConsolidated && tx.metadata?.originalItems) {
            return tx.metadata.originalItems.some((i: any) => i.label.includes(`Placa ${v.plate}`));
          }

          return tx.taxType === TaxType.VEHICULO &&
                 (tx.metadata?.plateNumber === v.plate || tx.description.includes(v.plate)) &&
                 new Date(tx.date).getFullYear() === currentYear;
        });

        const isVehRenewalConsolidated = arrYear > 0 && (currentYear < arrYear || (currentYear === arrYear && renewalMonth <= arrMonth));

        if (!isVehRenewalConsolidated && !hasPaid) {
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

  // 4. Payment Arrangement Installment
  if (t.paymentArrangement && t.paymentArrangement.estado === 'ACTIVO') {
    if (t.paymentArrangement.abono > 0 && !t.paymentArrangement.abonoPagado) {
      debts.push({
        id: `arr-abono-${t.paymentArrangement.id}`,
        type: 'DEUDA_ARRAS',
        label: `Abono Inicial - Arreglo de Pago`,
        amount: t.paymentArrangement.abono,
        description: `Abono inicial pactado para activar el convenio de pago`,
        isPriority: true,
        isPastDue: true,
        metadata: { isArrangementAbono: true, arrangementId: t.paymentArrangement.id }
      });
    } else {
      const cuotaN = t.paymentArrangement.cuotasPagadas + 1;
      
      // Calculate if the installment is past due based on months since creation
      const arrDateParts = t.paymentArrangement.fechaCreacion.split('-');
      const startYear = parseInt(arrDateParts[0]) || currentYear;
      const startMonth = parseInt(arrDateParts[1]) || currentMonth;
      const monthsSinceCreation = (currentYear - startYear) * 12 + (currentMonth - startMonth);
      
      // It is past due if the months passed since creation is greater than the cuotas paid
      const isPastDue = t.paymentArrangement.cuotasPagadas < monthsSinceCreation;

      debts.push({
        id: `arr-installment-${t.paymentArrangement.id}`,
        type: 'DEUDA_ARRAS',
        label: `Cuota Arreglo de Pago (${cuotaN} de ${t.paymentArrangement.cuotasTotales})`,
        amount: t.paymentArrangement.montoCuota,
        description: `Cuota mensual de arreglo de pago. Saldo de morosidad consolidada`,
        isPriority: true,
        isPastDue: isPastDue,
        metadata: { isArrangementInstallment: true, arrangementId: t.paymentArrangement.id, cuotaNumero: cuotaN, isPastDue }
      });
    }
  }

  return {
    total: debts.reduce((sum, item) => sum + item.amount, 0),
    items: debts
  };
};
