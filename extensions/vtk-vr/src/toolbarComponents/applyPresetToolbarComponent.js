import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import presets from '../presets.js';
import { Select } from '@ohif/ui';

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
  className,
}) {
  const [ctTransferFunctionPresetId, setCtTransferFunctionPresetId] = useState(
    initialCtTransferFunctionPresetId
  );

  const handleChangeCTTransferFunction = event => {
    if (event.target.value !== ctTransferFunctionPresetId) {
      setCtTransferFunctionPresetId(event.target.value);
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
    <div className={className}>
      <div className="container">
        <Select
          key="toolbar-select"
          options={ctTransferFunctionPresetOptions}
          value={ctTransferFunctionPresetId}
          onChange={handleChangeCTTransferFunction}
        ></Select>
      </div>
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
