/**
 * WizardSteps Component
 */

export function WizardSteps({ currentStep = 1, selectedLanguagesCount = 0 }) {
  return (
    <div className="ts-step-bar">
      <div className={`ts-step-item ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
        <span className="ts-step-number">{currentStep > 1 ? '✓' : '1'}</span>
        <span>{currentStep > 1 ? `${selectedLanguagesCount} Languages` : 'Select Target Languages'}</span>
      </div>
      <span className="ts-step-divider" />
      <div className={`ts-step-item ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
        <span className="ts-step-number">{currentStep > 2 ? '✓' : '2'}</span>
        <span>Choose Provider</span>
      </div>
      <span className="ts-step-divider" />
      <div className={`ts-step-item ${currentStep === 3 ? 'active' : ''}`}>
        <span className="ts-step-number">3</span>
        <span>Translation Progress</span>
      </div>
    </div>
  );
}

