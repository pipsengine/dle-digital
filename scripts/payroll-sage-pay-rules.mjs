/**
 * Sage-aligned PAYE calculation rules for HRIS (no runtime Sage dependency).
 */
export const roundMoney = (value) => Math.round((Number.isFinite(Number(value)) ? Number(value) : 0) * 100) / 100;

export const normalizedGrade = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');

export const isBasicEarningCode = (code) => {
  const upper = String(code || '').toUpperCase();
  if (upper === 'BASIC_LUMPSUM') return false;
  return /BASIC1_LUMPSUM|BASICSALARY|LUMPSUMTAX|EXP_BASIC|_(BASIC)$|^BASIC$|_BASIC$|COLA_BASIC|MGT_BASIC|SNR_BASIC|JNR_BASIC/i.test(upper);
};

export const isHousingEarningCode = (code) => /HOUSE|HOUSIN|_HOUS$/i.test(String(code || '').toUpperCase());
export const isTransportEarningCode = (code) => /TRANS/i.test(String(code || '').toUpperCase());

export const bhtFromEarningLines = (lines) =>
  roundMoney(
    lines
      .filter((line) => isBasicEarningCode(line.code) || isHousingEarningCode(line.code) || isTransportEarningCode(line.code))
      .reduce((sum, line) => sum + Number(line.amount || 0), 0),
  );

export const basicFromEarningLines = (lines) =>
  roundMoney(lines.filter((line) => isBasicEarningCode(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0));

const taxablePositive = (line) => {
  if (line.taxableAmount !== null && line.taxableAmount !== undefined) {
    return Number(line.taxableAmount) > 0 ? Number(line.taxableAmount) : 0;
  }
  return Number(line.amount || 0) > 0 ? Number(line.amount || 0) : 0;
};

export const resolvePayeRules = (option) =>
  option?.payeCalculation && typeof option.payeCalculation === 'object' ? option.payeCalculation : null;

export const payeExcludedCodes = (salaryGrade, earningLines, category, payeRules) => {
  const excluded = new Set(['REFUND']);
  if (Array.isArray(payeRules?.excludedEarningCodes)) {
    payeRules.excludedEarningCodes.forEach((code) => excluded.add(String(code).toUpperCase()));
    return excluded;
  }

  const codes = earningLines.map((line) => String(line.code || '').toUpperCase());
  const grade = normalizedGrade(salaryGrade);

  if (category === 'permanent' && grade === 'MGT7') {
    excluded.add('MGT_TRANS');
    excluded.add('MGT_UTILITY');
  }
  return excluded;
};

export const payeTaxableFromEarningLines = (lines, category, salaryGrade, payeRules = null) => {
  const excluded = payeExcludedCodes(salaryGrade, lines, category, payeRules);
  const includeRefund = Boolean(payeRules?.includeRefundInTaxable);

  if (/^EXP_USD|EXP_USDSNMGT|USD SENIOR/i.test(normalizedGrade(salaryGrade))) {
    return roundMoney(lines.reduce((sum, line) => sum + taxablePositive(line), 0));
  }

  if (category === 'lumpsum') {
    let monthly = roundMoney(
      lines.filter((line) => !excluded.has(String(line.code || '').toUpperCase())).reduce((sum, line) => sum + taxablePositive(line), 0),
    );
    if (includeRefund || monthly * 12 <= 876960) {
      monthly = roundMoney(
        monthly + lines.filter((line) => /^REFUND$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0),
      );
    }
    return monthly;
  }

  const hasTaxableAmount = lines.some((line) => line.taxableAmount !== null && line.taxableAmount !== undefined);
  if (hasTaxableAmount) {
    let monthly = roundMoney(
      lines
        .filter((line) => !excluded.has(String(line.code || '').toUpperCase()))
        .reduce((sum, line) => {
          if (line.taxableAmount !== null && line.taxableAmount !== undefined) return sum + Number(line.taxableAmount || 0);
          return sum + Number(line.amount || 0);
        }, 0),
    );
    if (includeRefund) {
      monthly = roundMoney(
        monthly + lines.filter((line) => /^REFUND$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0),
      );
    }
    return monthly;
  }

  const nonTaxableCodes = /^(PER_MEAL|PER_MEAL_JNR|SNR_NJIC|SNR_NTC|JNR_NJIC|REFUND)$/i;
  return roundMoney(
    lines
      .filter((line) => {
        const code = String(line.code || '').toUpperCase();
        if (excluded.has(code)) return false;
        if (line.taxable === false) return false;
        if (line.taxable === true) return Number(line.amount || 0) > 0;
        return !nonTaxableCodes.test(code) && Number(line.amount || 0) > 0;
      })
      .reduce((sum, line) => sum + Number(line.amount || 0), 0),
  );
};

export const lumpsumAnnualRentRelief = (monthlyTaxable) => {
  const annualTaxable = Math.max(0, Number(monthlyTaxable || 0) * 12);
  if (annualTaxable >= 2040000) return 500000;
  if (annualTaxable > 876960) return roundMoney(annualTaxable - 876960);
  return 0;
};

export const resolveAnnualRentRelief = ({ category, monthlyTaxable, option, payeRules, salaryGrade, earningLines }) => {
  if (Number.isFinite(Number(payeRules?.annualRentRelief))) return Number(payeRules.annualRentRelief);
  if (Number.isFinite(Number(option?.annualRentRelief)) && Number(option.annualRentRelief) > 0) return Number(option.annualRentRelief);
  if (category === 'stipend' || category === 'contract') return 0;
  if (category === 'lumpsum') return lumpsumAnnualRentRelief(monthlyTaxable);

  const codes = (earningLines || []).map((line) => String(line.code || '').toUpperCase());
  const grade = normalizedGrade(salaryGrade);
  if (grade === 'MGT7') return 400000;

  return 500000;
};

export const calculatePayeWithReliefs = ({
  monthlyTaxable,
  monthlyBht,
  monthlyBasic,
  nhfApplicable,
  rentRelief,
  includePensionRelief = true,
}) => {
  const annualTaxable = monthlyTaxable * 12;
  const annualPension = includePensionRelief ? roundMoney(monthlyBht * 0.08 * 12) : 0;
  const annualNhf = nhfApplicable ? roundMoney(monthlyBasic * 0.025 * 12) : 0;
  let chargeable = roundMoney(Math.max(0, annualTaxable - annualPension - annualNhf - rentRelief));
  const bands = [
    { amount: 800000, rate: 0 },
    { amount: 2200000, rate: 0.15 },
    { amount: 9000000, rate: 0.18 },
    { amount: 13000000, rate: 0.21 },
    { amount: 25000000, rate: 0.23 },
    { amount: null, rate: 0.25 },
  ];
  let remaining = chargeable;
  let annualPaye = 0;
  for (const band of bands) {
    const taxable = band.amount === null ? remaining : Math.min(remaining, Math.max(0, Number(band.amount)));
    annualPaye += taxable * band.rate;
    remaining = Math.max(0, remaining - taxable);
    if (remaining <= 0) break;
  }
  return roundMoney(annualPaye / 12);
};

export const calculateUsdSeniorManagementPaye = (monthlyTaxable, rate = 0.212) =>
  roundMoney(Math.max(0, Number(monthlyTaxable || 0)) * Number(rate));

export const hrisPayeFromEarnings = ({ earningLines, category, salaryGrade, employeeOption, nhfApplicable }) => {
  const payeRules = resolvePayeRules(employeeOption);
  if (Number.isFinite(Number(payeRules?.monthlyPayeOverride))) {
    return {
      paye: roundMoney(Number(payeRules.monthlyPayeOverride)),
      monthlyTaxable: payeTaxableFromEarningLines(earningLines, category, salaryGrade, payeRules),
    };
  }

  const monthlyTaxable = payeTaxableFromEarningLines(earningLines, category, salaryGrade, payeRules);
  const monthlyBht = bhtFromEarningLines(earningLines);
  const monthlyBasic = basicFromEarningLines(earningLines);
  const grade = normalizedGrade(salaryGrade);

  if (/^EXP_USD|EXP_USDSNMGT|USD SENIOR/i.test(grade)) {
    return {
      paye: calculateUsdSeniorManagementPaye(monthlyTaxable, Number(payeRules?.usdFlatRate || 0.212)),
      monthlyTaxable,
    };
  }

  const effectiveRules =
    payeRules ||
    (grade === 'MGT7' && category === 'permanent'
      ? { includeRefundInTaxable: true, disablePensionPayeRelief: true, annualRentRelief: 400000 }
      : null);

  const taxable = payeTaxableFromEarningLines(earningLines, category, salaryGrade, effectiveRules);
  const rentRelief = resolveAnnualRentRelief({
    category,
    monthlyTaxable: taxable,
    option: employeeOption,
    payeRules: effectiveRules,
    salaryGrade,
    earningLines,
  });

  return {
    paye: calculatePayeWithReliefs({
      monthlyTaxable: taxable,
      monthlyBht,
      monthlyBasic,
      nhfApplicable: category === 'permanent' && nhfApplicable,
      rentRelief,
      includePensionRelief: category === 'permanent' && !effectiveRules?.disablePensionPayeRelief,
    }),
    monthlyTaxable: taxable,
  };
};
