logPartner('start');

Array.from(document.querySelectorAll('script') ?? [])
  .filter((s) => s?.textContent?.includes('window["obvInit"]({'))
  .forEach((s) => {
    try {
      const scriptRaw = s.textContent;
      const scriptData = scriptRaw.slice(31, scriptRaw.length - 8);
      const data = JSON.parse(scriptData);
      const { completedMonthlyAmounts, currentMonthAmount } = data;
      const results = completedMonthlyAmounts.reduce(
        (result, next) => {
          const {
            payoutAmount,
            amount,
            hightowerUserBonusAmount,
            hightowerConvertedMemberEarnings,
            withholdingAmount,
            minimumGuaranteeAmount,
            withholdingPercentage,
          } = next;
          result.amount += amount;
          result.payoutAmount += payoutAmount;
          if (!isNaN(hightowerUserBonusAmount)) {
            result.hightowerUserBonusAmount += hightowerUserBonusAmount;
          }
          if (!isNaN(hightowerConvertedMemberEarnings)) {
            result.hightowerConvertedMemberEarnings +=
              hightowerConvertedMemberEarnings;
          }
          result.withholdingAmount += withholdingAmount;
          result.minimumGuaranteeAmount += minimumGuaranteeAmount;
          result.withholdingPercentage.push(withholdingPercentage);
          return result;
        },
        {
          payoutAmount: 0,
          amount: 0,
          hightowerUserBonusAmount: 0,
          hightowerConvertedMemberEarnings: 0,
          withholdingAmount: 0,
          minimumGuaranteeAmount: 0,
          withholdingPercentage: [],
        }
      );
      results.withholdingPercentageAverage =
        results.withholdingPercentage.reduce((total, next) => total + next, 0) /
        results.withholdingPercentage.length;

      renderPartnerStats(results);
      logPartner('finished');
    } catch (error) {
      console.error('Medium Enhanced Stats [partner]', error);
    }
  });

function renderPartnerStats(results) {
  const container$ = document.querySelector('.js-selectPeriod');
  if (container$) {
    container$.classList.add('mes-partner-stats-extras-container');
    const {
      payoutAmount,
      amount,
      hightowerUserBonusAmount,
      hightowerConvertedMemberEarnings,
      withholdingAmount,
      minimumGuaranteeAmount,
      withholdingPercentageAverage,
    } = results;
    const partnerStatsExtrasDOM = document.createElement('div');
    partnerStatsExtrasDOM.className = 'mes-partner-stats-extras';
    partnerStatsExtrasDOM.innerHTML = `
            <div>
                <div class="entry"><span class="description">Amount</span> $${formatAmount(
                  amount
                )}</div>
                <div class="entry"><span class="description">Member Earnings</span> $${formatAmount(
                  hightowerConvertedMemberEarnings
                )}</div>
                <div class="entry"><span class="description">Bonus</span> $${formatAmount(
                  hightowerUserBonusAmount
                )}</div>
                <div class="entry"><span class="description">Guarantee Amount</span> $${formatAmount(
                  minimumGuaranteeAmount
                )}</div>
            </div>
            <div>
                <div class="entry"><span class="description">Witheld</span> $${formatAmount(
                  withholdingAmount
                )}</div>
                <div class="entry"><span class="description">Witheld (average %)</span> ${withholdingPercentageAverage}%</div>
            </div>
            <div><div class="entry total"><span class="description">Total Payout</span> $${formatAmount(
              payoutAmount
            )}</div></div>
          `;
    container$.appendChild(partnerStatsExtrasDOM);
  }
}

function formatAmount(number = 0) {
  if (number === 0) {
    return '0.00';
  }
  const decimals = number.toString().slice(-2);
  const integer = number.toString().slice(0, number.toString().length - 2);
  return `${integer}.${decimals}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function logPartner(...args) {
  console.log('Medium Enhanced Stats [partner] -', ...args);
}
