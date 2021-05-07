import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import presets from '../presets.js';
import { OldSelect } from '@ohif/ui';
import { useTranslation } from 'react-i18next';

import './apply-preset-toolbar-component.styl';

let initialCtTransferFunctionPresetId = 'vtkMRMLVolumePropertyNode4';

const ctTransferFunctionPresetOptions = presets.map(preset => {
  return { key: preset.name, value: preset.id };
});

function ApplyPresetToolbarComponent({
  parentContext,
  toolbarClickCallback,
  button,
  activeButtons,
  isActive,
}) {
  const [ctTransferFunctionPresetId, setCtTransferFunctionPresetId] = useState(
    initialCtTransferFunctionPresetId
  );

  const { t } = useTranslation('VtkVr');

  const handleChangeCTTransferFunction = selectedPresetId => {
    if (selectedPresetId !== ctTransferFunctionPresetId) {
      setCtTransferFunctionPresetId(selectedPresetId);
    }
    initialCtTransferFunctionPresetId = '';
  };

  useEffect(() => {
    if (ctTransferFunctionPresetId !== initialCtTransferFunctionPresetId) {
      toolbarClickCallback({
        commandName: 'applyCtTransferFunctionPresetId',
        commandOptions: {
          ctTransferFunctionPresetId: ctTransferFunctionPresetId,
        },
      });
    }
  }, [ctTransferFunctionPresetId, toolbarClickCallback]);

  return (
    <div className="apply-preset-container">
      <label htmlFor="toolbar-select">{t('Presets')}</label>
      <OldSelect
        id="toolbar-select"
        key="toolbar-select"
        options={ctTransferFunctionPresetOptions}
        value={ctTransferFunctionPresetId}
        onChange={handleChangeCTTransferFunction}
      ></OldSelect>
    </div>
  );
}

ApplyPresetToolbarComponent.propTypes = {
  parentContext: PropTypes.object.isRequired,
  toolbarClickCallback: PropTypes.func.isRequired,
  button: PropTypes.object.isRequired,
  activeButtons: PropTypes.array.isRequired,
  isActive: PropTypes.bool,
  className: PropTypes.string,
};

export default ApplyPresetToolbarComponent;
