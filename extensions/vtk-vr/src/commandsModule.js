import setVRLayout from './utils/setVRLayout.js';
import { applyPreset, applyPresetParameters } from './utils/applyPreset';
import presets from './presets.js';
import vtkInteractorStyleManipulator from 'vtk.js/Sources/Interaction/Style/InteractorStyleManipulator';
import Manipulators from 'vtk.js/Sources/Interaction/Manipulators';
import {
  toLowHighRange,
  toWindowLevel,
} from './utils/windowLevelRangeConverter.js';
import vtkImageMarchingCubes from 'vtk.js/Sources/Filters/General/ImageMarchingCubes';

const commandsModule = ({ commandsManager, servicesManager }) => {
  const { UINotificationService, LoggerService } = servicesManager.services;
  let defaultVOI;
  let apis = {};
  let defaultIStyle = {};

  // function getVOIFromCornerstoneViewport() {
  //   const dom = commandsManager.runCommand('getActiveViewportEnabledElement');
  //   const cornerstoneElement = cornerstone.getEnabledElement(dom);

  //   if (cornerstoneElement) {
  //     const imageId = cornerstoneElement.image.imageId;

  //     const Modality = cornerstone.metaData.get('Modality', imageId);

  //     if (Modality !== 'PT') {
  //       const { windowWidth, windowCenter } = cornerstoneElement.viewport.voi;

  //       return {
  //         windowWidth,
  //         windowCenter,
  //       };
  //     }
  //   }
  // }

  function setVOI(voi) {
    const { windowWidth, windowCenter } = voi;
    const lower = windowCenter - windowWidth / 2.0;
    const upper = windowCenter + windowWidth / 2.0;

    const rgbTransferFunction = apis[0].volumes[0]
      .getProperty()
      .getRGBTransferFunction(0);

    rgbTransferFunction.setRange(lower, upper);

    apis.forEach(api => {
      api._component.updateVOI(windowWidth, windowCenter);
    });
  }

  const actions = {
    applyCtTransferFunctionPresetId: ({ ctTransferFunctionPresetId }) => {
      const preset = presets.find(
        preset => preset.id === ctTransferFunctionPresetId
      );

      const actor = apis[0].volumes[0];
      applyPresetParameters.shift = 0;
      applyPreset(actor, preset);

      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();
      renderWindow.render();
    },
    enableLevelTool: () => {
      function updateVOI(apis, windowWidth, windowCenter) {
        apis.forEach(api => {
          api._component.updateVOI(windowWidth, windowCenter);
        });
      }
      const actor = apis[0].volumes[0];
      const range = actor
        .getProperty()
        .getRGBTransferFunction(0)
        .getMappingRange()
        .slice();
      let levels = toWindowLevel(...range);
      // defaultVOI = levels;

      const wMin = range[0];
      const wMax = range[1];

      const wGet = () => {
        return levels.windowCenter;
      };
      const getWindowLevel = () => {
        const r = actor
          .getProperty()
          .getRGBTransferFunction(0)
          .getMappingRange()
          .slice();
        return toWindowLevel(...r);
      };
      const setWindowLevel = (windowWidth, windowCenter) => {
        const lowHigh = toLowHighRange(windowWidth, windowCenter);

        levels.windowWidth = windowWidth;
        levels.windowCenter = windowCenter;

        actor
          .getProperty()
          .getRGBTransferFunction(0)
          .setMappingRange(lowHigh.lower, lowHigh.upper);
        updateVOI(apis, windowWidth, windowCenter);
      };

      const wSet = value => {
        const l = getWindowLevel();
        setWindowLevel(l.windowWidth, value);
      };

      const lMin = 0.01;
      const lMax = range[1] - range[0];

      const lGet = () => {
        return levels.windowWidth;
      };
      const lSet = value => {
        const l = getWindowLevel();
        setWindowLevel(value, l.windowCenter);
      };
      const rangeManipulator = Manipulators.vtkMouseRangeManipulator.newInstance(
        {
          button: 1,
          scrollEnabled: false,
        }
      );
      rangeManipulator.setVerticalListener(wMin, wMax, 1, wGet, wSet);
      rangeManipulator.setHorizontalListener(lMin, lMax, 1, lGet, lSet);

      const iStyle = vtkInteractorStyleManipulator.newInstance();
      iStyle.addMouseManipulator(rangeManipulator);

      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();
      renderWindow.getInteractor().setInteractorStyle(iStyle);
      apis[0].container.style.cursor = `url('data:image/svg+xml;utf8, <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-labelledby="title" width="2em" height="2em" fill="green" stroke="green" > <title id="title">Level</title> <path d="M14.5,3.5 a1 1 0 0 1 -11,11 Z" stroke="none" opacity="0.8" /> <circle cx="9" cy="9" r="8" fill="none" stroke-width="2" /> </svg>'), auto`;
    },
    enableISOTool: () => {
      const actor = apis[0].volumes[0];
      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();

      let { shiftRange, preset } = applyPresetParameters;

      const iMin = shiftRange[0];
      const iMax = shiftRange[1];
      applyPresetParameters.shift = iMin;

      function updateShiftValue(value) {
        // const isoValue = Number(value);
        applyPresetParameters.shift = value;
        applyPreset(actor, preset);
      }

      const iGet = () => {
        return applyPresetParameters.shift;
      };
      const iSet = value => {
        updateShiftValue(value);
      };

      const rangeManipulator = Manipulators.vtkMouseRangeManipulator.newInstance(
        {
          button: 1,
          scrollEnabled: false,
        }
      );

      rangeManipulator.setHorizontalListener(iMin, iMax, 1, iGet, iSet);

      const iStyle = vtkInteractorStyleManipulator.newInstance();
      iStyle.addMouseManipulator(rangeManipulator);

      renderWindow.getInteractor().setInteractorStyle(iStyle);
      apis[0].container.style.cursor = `url('data:image/svg+xml;utf8, <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-labelledby="title" width="2em" height="2em" fill="green" stroke="green" > <title id="title">Level</title> <path d="M14.5,3.5 a1 1 0 0 1 -11,11 Z" stroke="none" opacity="0.8" /> <circle cx="9" cy="9" r="8" fill="none" stroke-width="2" /> </svg>'), auto`;
    },
    resetVRView: () => {
      if (defaultVOI) {
        setVOI(defaultVOI);
      }
      apis[0].container.style.cursor = 'pointer';
      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();
      if (defaultIStyle) {
        renderWindow.getInteractor().setInteractorStyle(defaultIStyle);
      }
      // const iStyle = interactor.getInteractorStyle();
      // const n = iStyle.getNumberOfMouseManipulators();
      // iStyle.removeMouseManipulator(n - 1);
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
      // // Get current VOI if cornerstone viewport.
      // const cornerstoneVOI = getVOIFromCornerstoneViewport();
      // defaultVOI = cornerstoneVOI;
      try {
        apis = await setVRLayout(displaySet, viewportProps, 1, 1);
      } catch (error) {
        throw new Error(error);
      }
      // if (cornerstoneVOI) {
      //   setVOI(cornerstoneVOI);
      // }

      // Check if we have full WebGL 2 support
      const firstApi = apis[0];

      const renderWindow = firstApi.genericRenderWindow.getRenderWindow();
      defaultIStyle = renderWindow.getInteractor().getInteractorStyle();

      const openGLRenderWindow = firstApi.genericRenderWindow.getOpenGLRenderWindow();

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
    enableISOTool: {
      commandFn: actions.enableISOTool,
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
