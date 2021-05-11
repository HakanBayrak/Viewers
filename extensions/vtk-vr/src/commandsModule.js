import setVRLayout from './utils/setVRLayout.js';
import {
  applyPointsToPiecewiseFunction,
  applyPreset,
  applyPresetParameters,
} from './utils/applyPreset';
import presets from './presets.js';
import {
  toLowHighRange,
  toWindowLevel,
} from './utils/windowLevelRangeConverter.js';

import vtkInteractorStyleManipulator from 'vtk.js/Sources/Interaction/Style/InteractorStyleManipulator';
import Manipulators from 'vtk.js/Sources/Interaction/Manipulators';
import vtkImageCroppingWidget from 'vtk.js/Sources/Widgets/Widgets3D/ImageCroppingWidget';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import vtkImageCropFilter from 'vtk.js/Sources/Filters/General/ImageCropFilter';

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
        // 2d Cornerstone parlaklık ayarı ile uyumlu olması için yönü ters çeviriyoruz.
        const upsideValue = l.windowCenter - (value - l.windowCenter);
        let realValue = Math.max(wMin + 1, upsideValue); //Terslediğimiz için Range manipulator doğru hesaplayamaz minimumun altına düşmemesi lazım.
        realValue = Math.min(wMax - 1, realValue); // maximumu geçmemesi lazım.
        setWindowLevel(l.windowWidth, realValue);
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

      let { shiftRange, median, sharpness } = applyPresetParameters;

      const iMin = shiftRange[0];
      const iMax = shiftRange[1];
      applyPresetParameters.shift = 0;

      const cfun = actor.getProperty().getRGBTransferFunction(0);

      const currentRange = [2];
      const nodes = cfun.get().nodes;
      const size = nodes.length;
      if (size) {
        currentRange[0] = nodes[0].x;
        currentRange[1] = nodes[size - 1].x;
      }

      const ofun = actor.getProperty().getScalarOpacity(0);
      const p = ofun.getDataPointer();
      const normPoints = [];
      for (let i = 0; i < p.length; i += 2) {
        const value = p[i];
        const opacity = p[i + 1];
        normPoints.push([value, opacity, median, sharpness]);
      }

      function updateShiftValue(value) {
        applyPresetParameters.shift = value;
        applyPointsToPiecewiseFunction(normPoints, value, ofun);
        cfun.setMappingRange(currentRange[0] + value, currentRange[1] + value);
        cfun.updateRange();
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
      apis[0].container.style.cursor = `url('data:image/svg+xml;utf8, <svg id="master-artboard" viewBox="0 0 1400 980" version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" style="enable-background:new 0 0 1400 980;" width="3em" height="3em"><g transform="matrix(1.3467081785202026, 0, 0, 1.3467081785202026, 684.9716789253773, 273.4304045661414)"><path fill="green" d="M432 160H16a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16zm0 256H16a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16zM108.1 96h231.81A12.09 12.09 0 0 0 352 83.9V44.09A12.09 12.09 0 0 0 339.91 32H108.1A12.09 12.09 0 0 0 96 44.09V83.9A12.1 12.1 0 0 0 108.1 96zm231.81 256A12.09 12.09 0 0 0 352 339.9v-39.81A12.09 12.09 0 0 0 339.91 288H108.1A12.09 12.09 0 0 0 96 300.09v39.81a12.1 12.1 0 0 0 12.1 12.1z"/></g><g transform="matrix(1.5243285945379352, 0, 0, 1.5243285945379352, 26.245681261243433, -213.82029430492938)"><path fill="green" d="M377.941 169.941V216H134.059v-46.059c0-21.382-25.851-32.09-40.971-16.971L7.029 239.029c-9.373 9.373-9.373 24.568 0 33.941l86.059 86.059c15.119 15.119 40.971 4.411 40.971-16.971V296h243.882v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.568 0-33.941l-86.059-86.059c-15.119-15.12-40.971-4.412-40.971 16.97z"/></g></svg>'), auto`;
    },
    enableCropTool: () => {
      const actor = apis[0].volumes[0];
      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();
      const widgetManager = apis[0].widgetManager;
      const cropWidget = vtkImageCroppingWidget.newInstance();
      const viewCropWidget = widgetManager.addWidget(
        cropWidget,
        ViewTypes.VOLUME
      );
      widgetManager.enablePicking();
      renderWindow.render();

      const cropFilter = vtkImageCropFilter.newInstance();
      const mapper = actor.getMapper();
      const image = mapper.getInputData();
      cropFilter.setInputData(image);
      mapper.setInputConnection(cropFilter.getOutputPort());
      cropFilter.setCroppingPlanes(...image.getExtent());

      // update crop widget
      cropWidget.copyImageDataDescription(image);
      const cropState = cropWidget.getWidgetState().getCroppingPlanes();
      cropState.onModified(() => {
        cropFilter.setCroppingPlanes(cropState.getPlanes());
      });
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
    enableCropTool: {
      commandFn: actions.enableCropTool,
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
