export function mayRequestCamera(consentRecorded: boolean, consentId: string, onCameraScreen: boolean) {
  return consentRecorded && consentId.length > 0 && onCameraScreen;
}

export function mayUploadPhoto(grantedConsentIsActive: boolean, explicitlyConfirmed: boolean) {
  return grantedConsentIsActive && explicitlyConfirmed;
}
