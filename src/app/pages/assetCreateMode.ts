export type CreateMode = 'ocr' | 'manual';
export type UploadStep = 'upload' | 'processing' | 'preview';

interface CreateFormState {
  vehicleNumber: string;
  vin: string;
  model: string;
  year: string;
  owner: string;
  insuranceExpiry: string;
  nextInspection: string;
}

interface UploadedFilesState {
  vehicleRegistration: File | null;
  insurance: File | null;
  loanSchedule: File[];
}

function hasTextInput(form: CreateFormState): boolean {
  return (
    Boolean(form.vehicleNumber.trim())
    || Boolean(form.vin.trim())
    || Boolean(form.model.trim())
    || Boolean(form.year.trim())
    || Boolean(form.owner.trim())
    || Boolean(form.insuranceExpiry.trim())
    || Boolean(form.nextInspection.trim())
  );
}

function hasSelectedFiles(files: UploadedFilesState): boolean {
  return (
    files.vehicleRegistration !== null
    || files.insurance !== null
    || files.loanSchedule.length > 0
  );
}

export function resolveCreateModeSwitch({
  nextMode,
  hasRegistrationFile,
  hasOcrOutput,
}: {
  nextMode: CreateMode;
  hasRegistrationFile: boolean;
  hasOcrOutput: boolean;
}): UploadStep {
  if (nextMode === 'manual') {
    return 'preview';
  }
  if (hasRegistrationFile && hasOcrOutput) {
    return 'preview';
  }
  return 'upload';
}

export function isCreateDirty({
  createMode,
  uploadStep,
  createForm,
  uploadedFiles,
}: {
  createMode: CreateMode;
  uploadStep: UploadStep;
  createForm: CreateFormState;
  uploadedFiles: UploadedFilesState;
}): boolean {
  if (hasTextInput(createForm) || hasSelectedFiles(uploadedFiles)) {
    return true;
  }
  return createMode === 'ocr' && uploadStep !== 'upload';
}
