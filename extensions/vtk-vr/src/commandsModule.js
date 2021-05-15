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
import { cropToolParams } from './toolbarComponents/cropToolParams.js';

const commandsModule = ({ commandsManager, servicesManager }) => {
  const { UINotificationService, LoggerService } = servicesManager.services;
  let defaultVOI;
  let apis = [];
  let defaultIStyle = {};
  let {
    cropWidget: cropWidget,
    cropFilter: cropFilter,
    widgetLoaded: widgetLoaded,
  } = cropToolParams;

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

      const openGLRenderWindow = apis[0].genericRenderWindow.getOpenGLRenderWindow();
      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();
      renderWindow.getInteractor().setInteractorStyle(iStyle);
      apis[0].container.style.cursor = `url('data:image/svg+xml;utf8, <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-labelledby="title" width="2em" height="2em" fill="green" stroke="green" > <title id="title">Level</title> <path d="M14.5,3.5 a1 1 0 0 1 -11,11 Z" stroke="none" opacity="0.8" /> <circle cx="9" cy="9" r="8" fill="none" stroke-width="2" /> </svg>'), auto`;
      openGLRenderWindow.setCursor(apis[0].container.style.cursor);
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

      const openGLRenderWindow = apis[0].genericRenderWindow.getOpenGLRenderWindow();
      renderWindow.getInteractor().setInteractorStyle(iStyle);
      apis[0].container.style.cursor = `url('data:image/svg+xml;utf8, <svg id="master-artboard" viewBox="0 0 1400 980" version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" style="enable-background:new 0 0 336 235.2;" width="3em" height="3em"><rect id="ee-background" x="0" y="0" width="1400" height="980" style="fill: white; fill-opacity: 0; pointer-events: none;"/><defs><style id="ee-google-fonts">@import url(https://fonts.googleapis.com/css?family=Audiowide:400);</style></defs><g transform="matrix(1.4038123092392405, 0, 0, 1.4038123092392405, 671.816655540979, 251.66449142846483)"><path fill="green" d="M87 481.8h73.7v-73.6H87zM25.4 346.6v61.6H87v-61.6zm466.2-169.7c-23-74.2-82.4-133.3-156.6-156.6C164.9-32.8 8 93.7 8 255.9h95.8c0-101.8 101-180.5 208.1-141.7 39.7 14.3 71.5 46.1 85.8 85.7 39.1 107-39.7 207.8-141.4 208v.3h-.3V504c162.6 0 288.8-156.8 235.6-327.1zm-235.3 231v-95.3h-95.6v95.6H256v-.3z"/></g><g transform="matrix(1.5198686423497296, 0, 0, 1.5198686423497296, 92.4303801220752, -215.4293444510317)"><path fill="green" d="M377.941 169.941V216H134.059v-46.059c0-21.382-25.851-32.09-40.971-16.971L7.029 239.029c-9.373 9.373-9.373 24.568 0 33.941l86.059 86.059c15.119 15.119 40.971 4.411 40.971-16.971V296h243.882v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.568 0-33.941l-86.059-86.059c-15.119-15.12-40.971-4.412-40.971 16.97z"/></g></svg>'), auto`;
      openGLRenderWindow.setCursor(apis[0].container.style.cursor);
    },
    enableCropTool: ({ enable, hide }) => {
      const actor = apis[0].volumes[0];
      const mapper = actor.getMapper();
      const widgetManager = apis[0].widgetManager;
      const renderWindow = apis[0].genericRenderWindow.getRenderWindow();
      const openGLRenderWindow = apis[0].genericRenderWindow.getOpenGLRenderWindow();

      if (enable === 'Nop') {
        if (hide === 'Hide' && widgetLoaded) {
          cropWidget.set({ visibility: false });
          widgetManager.enablePicking();
          renderWindow.render();
          widgetManager.disablePicking();
          openGLRenderWindow.setCursor('pointer');
          return;
        } else if (hide === 'Show' && widgetLoaded) {
          cropWidget.set({ visibility: true });
          widgetManager.enablePicking();
          renderWindow.render();
          return;
        }
      }
      if (enable === 'Remove') {
        if (!widgetLoaded) return;
        cropFilter.reset();
        const img = mapper.getInputData();
        mapper.setInputData(img);
        cropFilter.delete();
        widgetManager.removeWidget(cropWidget);
        widgetManager.disablePicking();
        cropWidget = null;
        cropFilter = null;
        widgetLoaded = false;
        openGLRenderWindow.setCursor('pointer');
        return;
      }
      if (enable === 'Activate') {
        const image = mapper.getInputData();
        cropWidget = vtkImageCroppingWidget.newInstance();

        const viewWidget = widgetManager.addWidget(
          cropWidget,
          ViewTypes.VOLUME
        );
        viewWidget.setDisplayCallback(coords => {
          if (coords) {
            return coords;
          }
        });
        // widgetManager.grabFocus(cropWidget);
        widgetManager.enablePicking();
        renderWindow.render();
        cropFilter = vtkImageCropFilter.newInstance();
        cropFilter.setInputData(image);
        mapper.setInputConnection(cropFilter.getOutputPort());
        cropFilter.setCroppingPlanes(...image.getExtent());
        cropWidget.set({
          faceHandlesEnabled: false,
          edgeHandlesEnabled: false,
        });
        widgetLoaded = true;
        // update crop widget
        cropWidget.copyImageDataDescription(image);
        const cropState = cropWidget.getWidgetState().getCroppingPlanes();
        cropState.onModified(() => {
          cropFilter.setCroppingPlanes(cropState.getPlanes());
        });
        openGLRenderWindow.setCursor(apis[0].container.style.cursor);
        // const openGLRenderWindow = apis[0].genericRenderWindow.getOpenGLRenderWindow();
        // openGLRenderWindow.cursorVisibility = false;
      }
    },
    resetVRView: () => {
      if (defaultVOI) {
        setVOI(defaultVOI);
      }
      apis[0].container.style.cursor = 'pointer';
      const openGLRenderWindow = apis[0].genericRenderWindow.getOpenGLRenderWindow();
      openGLRenderWindow.setCursor('pointer');
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
