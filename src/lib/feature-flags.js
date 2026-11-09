const FEATURE_FLAGS = {
  paymentsEnabled: false,
  companionsEnabled: false,
  practicepadEnabled: false,
  toneTunerEnabled: true,
  knowMeDashboard: false,
  photoUploads: false,
  pushNotifications: false,
};

export function isEnabled(flag) {
  return FEATURE_FLAGS[flag] === true;
}
