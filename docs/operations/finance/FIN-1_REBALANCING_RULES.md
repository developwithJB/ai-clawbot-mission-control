# FIN-1 · Rebalancing Rules

## Baseline targets
- VTI 35%
- QQQM 20%
- SGOV 10%
- BTC 25%
- ETH 10%

## When to rebalance
1. **Threshold breach:** any position drifts by >5 percentage points from target
2. **Monthly checkpoint:** rebalance to targets if total drift across portfolio >8 points
3. **Risk mode changes:** rebalance immediately if defensive mode is activated

## How to rebalance
- Prefer using new contributions first
- If selling is required, reduce highest-overweight risk assets first
- Keep tax/fee impact minimal (for larger future portfolios)

## Rebalance guardrails
- Do not exceed 2 discretionary rebalance actions/week
- No full liquidation unless hard freeze review recommends
- Rebalance actions must be logged with reason

## Defensive rebalance protocol
At -20% drawdown:
- Reduce QQQM by up to 5%
- Reduce BTC by up to 5%
- Increase SGOV/cash by equivalent amount

At -30% drawdown:
- Freeze all new risk adds
- Risk review required before any rebalance except de-risking
