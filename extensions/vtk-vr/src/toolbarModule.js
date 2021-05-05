import ApplyPresetToolbarComponent from './toolbarComponents/applyPresetToolbarComponent';
import VTKVRToolbarButton from './toolbarComponents/VTKVRToolbarButton';

const TOOLBAR_BUTTON_TYPES = {
  COMMAND: 'command',
  SET_TOOL_ACTIVE: 'setToolActive',
};
const definitions = [
  {
    id: 'WWWCVR',
    label: 'WWWC',
    icon: 'level',
    //
    type: TOOLBAR_BUTTON_TYPES.SET_TOOL_ACTIVE,
    commandName: 'enableLevelTool',
    commandOptions: {},
  },
  {
    id: 'applyPreset',
    label: 'Apply Preset',
    icon: 'later',
    CustomComponent: ApplyPresetToolbarComponent,
    commandName: 'applyCtTransferFunctionPresetId',
    type: TOOLBAR_BUTTON_TYPES.COMMAND,
  },
  {
    id: 'ResetVR',
    label: 'Reset',
    icon: 'reset',
    //
    type: TOOLBAR_BUTTON_TYPES.COMMAND,
    commandName: 'resetVRView',
    commandOptions: {},
  },
  {
    id: '3DVR',
    label: '3D VR',
    icon: 'cubes-solid',
    //
    CustomComponent: VTKVRToolbarButton,
    type: TOOLBAR_BUTTON_TYPES.COMMAND,
    commandName: 'VR3d',
    context: 'ACTIVE_VIEWPORT::CORNERSTONE',
  },
];

export default {
  definitions,
  defaultContext: 'ACTIVE_VIEWPORT::VTK_VR',
};
