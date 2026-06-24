/**
 * Capacity and cost planning helper for Work IQ / Fabric / Foundry workloads.
 */

/**
 * @param {{
 *   workload: "work-iq"|"fabric-iq"|"foundry-iq";
 *   monthlyRequests: number;
 *   unitCost: number;
 *   baselineCapacityUnits: number;
 *   growthRate: number; // 0-1 monthly
 * }[]} inputs
 * @param {number} months
 */
export function forecastCapacity(inputs, months = 6) {
  if (months <= 0) throw new Error("months must be > 0");
  return inputs.map((input) => {
    validateCapacityInput(input);
    /** @type {Array<{ month: number; requests: number; capacityUnits: number; estimatedCost: number }>} */
    const timeline = [];
    let requests = input.monthlyRequests;
    for (let month = 1; month <= months; month += 1) {
      const capacityUnits = Math.ceil((requests / input.monthlyRequests) * input.baselineCapacityUnits);
      const estimatedCost = requests * input.unitCost;
      timeline.push({
        month,
        requests: Math.round(requests),
        capacityUnits,
        estimatedCost: Number(estimatedCost.toFixed(2)),
      });
      requests = requests * (1 + input.growthRate);
    }
    return {
      workload: input.workload,
      timeline,
    };
  });
}

/**
 * @param {ReturnType<typeof forecastCapacity>} forecast
 * @param {number} budgetThreshold
 */
export function detectCapacityBudgetPressure(forecast, budgetThreshold) {
  const alerts = [];
  for (const series of forecast) {
    for (const point of series.timeline) {
      if (point.estimatedCost > budgetThreshold) {
        alerts.push({
          workload: series.workload,
          month: point.month,
          estimatedCost: point.estimatedCost,
          capacityUnits: point.capacityUnits,
        });
      }
    }
  }
  return alerts;
}

function validateCapacityInput(input) {
  if (!["work-iq", "fabric-iq", "foundry-iq"].includes(input.workload)) {
    throw new Error("workload must be work-iq|fabric-iq|foundry-iq");
  }
  if (typeof input.monthlyRequests !== "number" || input.monthlyRequests <= 0) {
    throw new Error("monthlyRequests must be > 0");
  }
  if (typeof input.unitCost !== "number" || input.unitCost < 0) {
    throw new Error("unitCost must be >= 0");
  }
  if (typeof input.baselineCapacityUnits !== "number" || input.baselineCapacityUnits <= 0) {
    throw new Error("baselineCapacityUnits must be > 0");
  }
  if (typeof input.growthRate !== "number" || input.growthRate < 0 || input.growthRate > 1) {
    throw new Error("growthRate must be between 0 and 1");
  }
}

