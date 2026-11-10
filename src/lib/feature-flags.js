const FEATURE_FLAGS = {
  paymentsEnabled: false,
  companionsEnabled: true,
  practicepadEnabled: true,
  toneTunerEnabled: true,
  knowMeDashboard: true,
  photoUploads: false,
  pushNotifications: false,
};

export function isEnabled(flag) {
  return FEATURE_FLAGS[flag] === true;
}
