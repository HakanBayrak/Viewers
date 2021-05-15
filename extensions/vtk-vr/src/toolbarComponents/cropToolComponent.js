import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { cropToolParams } from './cropToolParams';
import { Checkbox } from '@ohif/ui';
import { useTranslation } from 'react-i18next';
import './cropToolComponent.styl';

const CropToolComponent = ({
  parentContext,
  toolbarClickCallback,
  button,
  activeButtons,
  isActive,
}) => {
  const { t } = useTranslation('VtkVr');

  const {
    widgetLoaded: widgetLoaded,
    filterVisible: filterVisible,
  } = cropToolParams;

  const [state, setState] = useState({
    widgetLoaded: widgetLoaded,
    filterVisible: filterVisible,
    activateChecked: false,
    hideChecked: false,
    activateDisabled: false,
    hideDisabled: true,
    controllerClassName: 'ohif-checkbox disabled',
  });

  function onChangeActivateCheckbox(checked) {
    if (checked) {
      setState({
        ...state,
        activateChecked: checked,
        hideDisabled: false,
        hideChecked: false,
        controllerClassName: 'ohif-checkbox',
      });
      toolbarClickCallback({
        commandName: 'enableCropTool',
        commandOptions: {
          enable: 'Activate',
          hide: 'Nop',
        },
      });
    } else {
      setState({
        ...state,
        activateChecked: checked,
        hideDisabled: true,
        controllerClassName: 'ohif-checkbox disabled',
      });
      toolbarClickCallback({
        commandName: 'enableCropTool',
        commandOptions: {
          enable: 'Remove',
          hide: 'Nop',
        },
      });
    }
  }

  function onChangeHideCheckbox(checked) {
    setState({ ...state, hideChecked: checked });
    if (checked) {
      toolbarClickCallback({
        commandName: 'enableCropTool',
        commandOptions: {
          enable: 'Nop',
          hide: 'Hide',
        },
      });
    } else {
      toolbarClickCallback({
        commandName: 'enableCropTool',
        commandOptions: {
          enable: 'Nop',
          hide: 'Show',
        },
      });
    }
  }

  return (
    <div className="crop-tool-container">
      <div className="controller">
        <div className="crop-tool-label">{t('Crop Tool')}</div>
        <Checkbox
          label={t('Activate')}
          checked={state.activateChecked}
          disabled={state.activateDisabled}
          onChange={onChangeActivateCheckbox}
        ></Checkbox>
        <Checkbox
          className={state.controllerClassName}
          label={t('Hide')}
          checked={state.hideChecked}
          disabled={state.hideDisabled}
          onChange={onChangeHideCheckbox}
        ></Checkbox>
      </div>
    </div>
  );
};

CropToolComponent.propTypes = {
  parentContext: PropTypes.object.isRequired,
  toolbarClickCallback: PropTypes.func.isRequired,
  button: PropTypes.object.isRequired,
  activeButtons: PropTypes.array.isRequired,
  isActive: PropTypes.bool,
  className: PropTypes.string,
};

export default CropToolComponent;
