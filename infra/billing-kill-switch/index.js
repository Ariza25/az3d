'use strict';

const { CloudBillingClient } = require('@google-cloud/billing');

const billing = new CloudBillingClient();

const decodeBudgetNotification = (cloudEvent) => {
  const encoded = cloudEvent?.data?.message?.data ?? cloudEvent?.data;
  if (!encoded || typeof encoded !== 'string') {
    throw new Error('Budget notification without Pub/Sub data');
  }
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
};

exports.stopBilling = async (cloudEvent) => {
  const projectID = process.env.TARGET_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectID) throw new Error('TARGET_PROJECT_ID is not configured');

  let notification;
  try {
    notification = decodeBudgetNotification(cloudEvent);
  } catch (error) {
    console.warn(`Ignoring invalid budget notification: ${error.message}`);
    return;
  }
  const cost = Number(notification.costAmount);
  const budget = Number(notification.budgetAmount);
  if (!Number.isFinite(cost) || !Number.isFinite(budget)) {
    console.warn('Ignoring budget notification with invalid amounts');
    return;
  }
  if (cost < budget) {
    console.log(`No action required: cost ${cost} is below budget ${budget}`);
    return;
  }

  const projectName = `projects/${projectID}`;
  const [current] = await billing.getProjectBillingInfo({ name: projectName });
  if (!current.billingEnabled) {
    console.log(`Billing is already disabled for ${projectID}`);
    return;
  }

  console.error(`Budget reached: disabling billing for ${projectID}`);
  await billing.updateProjectBillingInfo({
    name: projectName,
    resource: { billingAccountName: '' },
  });
};
