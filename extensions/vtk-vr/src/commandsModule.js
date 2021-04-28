import cornerstone from 'cornerstone-core';
import setVRLayout from './utils/setVRLayout.js';
import throttle from 'lodash.throttle';
import { vtkInteractorStyleMPRWindowLevel } from 'react-vtkjs-viewport';
import applyPreset from './utils/applyPreset';
import presets from './presets.js';

const commandsModule = ({ commandsManager, servicesManager }) => {
  const { UINotificationService, LoggerService } = servicesManager.services;
  let defaultVOI;
  let apis = {};

  function getVOIFromCornerstoneViewport() {
    const dom = commandsManager.runCommand('getActiveViewportEnabledElement');
    const cornerstoneElement = cornerstone.getEnabledElement(dom);

    if (cornerstoneElement) {
      const imageId = cornerstoneElement.image.imageId;

      const Modality = cornerstone.metaData.get('Modality', imageId);

      if (Modality !== 'PT') {
        const { windowWidth, windowCenter } = cornerstoneElement.viewport.voi;

        return {
          windowWidth,
          windowCenter,
        };
      }
    }
  }

  function setVOI(voi) {
    const { windowWidth, windowCenter } = voi;
    const lower = windowCenter - windowWidth / 2.0;
    const upper = windowCenter + windowWidth / 2.0;

    const rgbTransferFunction = apis[0].volumes[0]
      .getProperty()
      .getRGBTransferFunction(0);

    // rgbTransferFunction.setRange(lower, upper);
    rgbTransferFunction.setMappingRange(lower, upper);
    apis[0].genericRenderWindow.getRenderWindow().render();
    // apis.forEach(api => {
    //   api.updateVOI(windowWidth, windowCenter);
  }

  const actions = {
    applyCtTransferFunctionPresetId: ({ ctTransferFunctionPresetId }) => {
      const preset = presets.find(
        preset => preset.id === ctTransferFunctionPresetId
      );

      const actor = apis[0].volumes[0];

      applyPreset(actor, preset);

      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();
      renderWindow.render();
    },
    enableLevelTool: () => {
      function updateVOI(apis, windowWidth, windowCenter) {
        apis.forEach(api => {
          api.updateVOI(windowWidth, windowCenter);
        });
      }

      const throttledUpdateVOIs = throttle(updateVOI, 16, { trailing: true }); // ~ 60 fps

      const callbacks = {
        setOnLevelsChanged: ({ windowCenter, windowWidth }) => {
          apis.forEach(api => {
            const renderWindow = api.genericRenderWindow.getRenderWindow();

            renderWindow.render();
          });

          throttledUpdateVOIs(apis, windowWidth, windowCenter);
        },
      };

      apis.forEach((api, apiIndex) => {
        const istyle = vtkInteractorStyleMPRWindowLevel.newInstance();

        api.setInteractorStyle({
          istyle,
          callbacks,
          configuration: { apis, apiIndex, uid: api.uid },
        });
      });
    },
    VR3d: async ({ viewports }) => {
      const displaySet =
        viewports.viewportSpecificData[viewports.activeViewportIndex];

      const viewportProps = [
        {
          //Axial
          orientation: {
            sliceNormal: [0, 0, 1],
            viewUp: [0, -1, 0],
          },
        },
      ];
      // Get current VOI if cornerstone viewport.
      const cornerstoneVOI = getVOIFromCornerstoneViewport();
      defaultVOI = cornerstoneVOI;
      try {
        apis = await setVRLayout(displaySet, viewportProps, 1, 1);
      } catch (error) {
        throw new Error(error);
      }
      if (cornerstoneVOI) {
        setVOI(cornerstoneVOI);
      }
      // Check if we have full WebGL 2 support
      const firstApi = apis[0];
      const openGLRenderWindow = apis[0].genericRenderWindow.getOpenGLRenderWindow();

      if (!openGLRenderWindow.getWebgl2()) {
        // Throw a warning if we don't have WebGL 2 support,
        // And the volume is too big to fit in a 2D texture

        const openGLContext = openGLRenderWindow.getContext();
        const maxTextureSizeInBytes = openGLContext.getParameter(
          openGLContext.MAX_TEXTURE_SIZE
        );

        const maxBufferLengthFloat32 =
          (maxTextureSizeInBytes * maxTextureSizeInBytes) / 4;

        const dimensions = firstApi.volumes[0]
          .getMapper()
          .getInputData()
          .getDimensions();

        const volumeLength = dimensions[0] * dimensions[1] * dimensions[2];

        if (volumeLength > maxBufferLengthFloat32) {
          const message =
            'This volume is too large to fit in WebGL 1 textures and will display incorrectly. Please use a different browser to view this data';
          LoggerService.error({ message });
          UINotificationService.show({
            title: 'Browser does not support WebGL 2',
            message,
            type: 'error',
            autoClose: false,
          });
        }
      }
    },
  };
  const definitions = {
    applyCtTransferFunctionPresetId: {
      commandFn: actions.applyCtTransferFunctionPresetId,
      options: {},
    },
    enableLevelTool: {
      commandFn: actions.enableLevelTool,
      options: {},
    },
    resetVRView: {
      commandFn: actions.resetVRView,
      options: {},
    },
    VR3d: {
      commandFn: actions.VR3d,
      storeContexts: ['viewports'],
      options: {},
      context: 'VIEWER',
    },
  };

  return {
    definitions,
    defaultContext: 'ACTIVE_VIEWPORT::VTK_VR',
  };
};

export default commandsModule;
