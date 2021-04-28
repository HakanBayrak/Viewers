import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import cornerstone from 'cornerstone-core';
import OHIF from '@ohif/core';
import {
  getImageData,
  loadImageData,
  View3D,
} from './react-vtkjs/index.umd.min.js';
import presets from './presets.js';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import LoadingIndicator from './LoadingIndicator.js';
import applyPreset from './utils/applyPreset';

const { StackManager } = OHIF.utils;
const { setViewportActive } = OHIF.redux.actions;
let apis = [];

const OHIFVTKVrViewport = props => {
  const [volumeRenderingVolumes, setVolumeRenderingVolumes] = useState(null);
  const [ctTransferFunctionPresetId, setCtTransferFunctionPresetId] = useState(
    'vtkMRMLVolumePropertyNode4'
  );
  // const [petColorMapId, setPetColorMapId] = useState('hsv');
  const [percentComplete, setPercentComplete] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { viewports } = useSelector(state => state.viewports.layout);
  const dispatch = useDispatch();

  const saveApiReference = api => {
    // commandsModule içinde 3d api referansına erişen promise fonksiyon burada resolve oluyor.
    // commandsModule içinde çağrılan setVRLayout metodunda afterCreation callback olarak redux store'a kaydedilmişti.
    if (viewports && viewports[0].vtk_vr) {
      viewports[0].vtk_vr.afterCreation(api);
    }
    apis = [api];
  };

  const getCornerstoneStack = (
    studies,
    StudyInstanceUID,
    displaySetInstanceUID,
    SOPInstanceUID,
    frameIndex
  ) => {
    // Create shortcut to displaySet
    const study = studies.find(
      study => study.StudyInstanceUID === StudyInstanceUID
    );

    const displaySet = study.displaySets.find(set => {
      return set.displaySetInstanceUID === displaySetInstanceUID;
    });

    // Get stack from Stack Manager
    const storedStack = StackManager.findOrCreateStack(study, displaySet);

    // Clone the stack here so we don't mutate it
    const stack = Object.assign({}, storedStack);

    if (frameIndex !== undefined) {
      stack.currentImageIdIndex = frameIndex;
    } else if (SOPInstanceUID) {
      const index = stack.imageIds.findIndex(imageId => {
        const imageIdSOPInstanceUID = cornerstone.metaData.get(
          'SOPInstanceUID',
          imageId
        );

        return imageIdSOPInstanceUID === SOPInstanceUID;
      });

      if (index > -1) {
        stack.currentImageIdIndex = index;
      }
    } else {
      stack.currentImageIdIndex = 0;
    }

    return stack;
  };

  function createActorMapper(imageData) {
    const mapper = vtkVolumeMapper.newInstance();
    mapper.setInputData(imageData);

    const actor = vtkVolume.newInstance();
    actor.setMapper(mapper);

    return {
      actor,
      mapper,
    };
  }

  const createCT3dPipeline = useCallback(
    (imageData, ctTransferFunctionPresetId) => {
      const { actor, mapper } = createActorMapper(imageData);

      const sampleDistance =
        1.2 *
        Math.sqrt(
          imageData
            .getSpacing()
            .map(v => v * v)
            .reduce((a, b) => a + b, 0)
        );

      const range = imageData
        .getPointData()
        .getScalars()
        .getRange();
      actor
        .getProperty()
        .getRGBTransferFunction(0)
        .setRange(range[0], range[1]);

      mapper.setSampleDistance(sampleDistance);

      const preset = presets.find(
        preset => preset.id === ctTransferFunctionPresetId
      );

      applyPreset(actor, preset);

      actor.getProperty().setScalarOpacityUnitDistance(0, 2.5);

      return actor;
    },
    []
  );

  const rerenderAll = useCallback(() => {
    // Update all render windows, since the automatic re-render might not
    // happen if the viewport is not currently using the painting widget
    Object.keys(apis).forEach(viewportIndex => {
      const renderWindow = apis[
        viewportIndex
      ].genericRenderWindow.getRenderWindow();

      renderWindow.render();
    });
  }, []);

  const loadDataset = useCallback(
    (imageIds, displaySetInstanceUid) => {
      const imageDataObject = getImageData(imageIds, displaySetInstanceUid);

      loadImageData(imageDataObject);

      const numberOfFrames = imageIds.length;

      const onPixelDataInsertedCallback = numberProcessed => {
        if (!isLoading) setIsLoading(true);
        const _percentComplete = Math.floor(
          (numberProcessed * 100) / numberOfFrames
        );

        if (percentComplete !== _percentComplete) {
          setPercentComplete(_percentComplete);
        }

        if (_percentComplete % 20 === 0) {
          rerenderAll();
        }
      };

      const onAllPixelDataInsertedCallback = () => {
        rerenderAll();
        setIsLoading(false);
      };

      imageDataObject.onPixelDataInserted(onPixelDataInsertedCallback);
      imageDataObject.onAllPixelDataInserted(onAllPixelDataInsertedCallback);

      return imageDataObject;
    },
    [isLoading, percentComplete, rerenderAll]
  );

  useEffect(() => {
    const { studies, displaySet } = props.viewportData;
    const {
      StudyInstanceUID,
      displaySetInstanceUID,
      SOPInstanceUID,
      frameIndex,
    } = displaySet;
    const stack = getCornerstoneStack(
      studies,
      StudyInstanceUID,
      displaySetInstanceUID,
      SOPInstanceUID,
      frameIndex
    );
    if (!volumeRenderingVolumes) {
      const ctImageDataObject = loadDataset(
        stack.imageIds,
        displaySetInstanceUID
      );
      const ctImageData = ctImageDataObject.vtkImageData;
      const ctVolVR = createCT3dPipeline(
        ctImageData,
        ctTransferFunctionPresetId
      );
      setVolumeRenderingVolumes([ctVolVR]);
      dispatch(setViewportActive(0));
    }
    // return () => setPercentComplete(0);
  }, [
    createCT3dPipeline,
    ctTransferFunctionPresetId,
    dispatch,
    loadDataset,
    props.viewportData,
    volumeRenderingVolumes,
  ]);

  const style = { width: '100%', height: '100%', position: 'relative' };

  return (
    <>
      <div style={style}>
        {isLoading && <LoadingIndicator percentComplete={percentComplete} />}
        {volumeRenderingVolumes && (
          <View3D
            volumes={volumeRenderingVolumes}
            onCreated={saveApiReference}
          />
        )}
      </div>
    </>
  );
};

OHIFVTKVrViewport.propTypes = {
  viewportData: PropTypes.shape({
    studies: PropTypes.array.isRequired,
    displaySet: PropTypes.shape({
      StudyInstanceUID: PropTypes.string.isRequired,
      displaySetInstanceUID: PropTypes.string.isRequired,
      sopClassUIDs: PropTypes.arrayOf(PropTypes.string),
      SOPInstanceUID: PropTypes.string,
      frameIndex: PropTypes.number,
    }),
  }),
  viewportIndex: PropTypes.number.isRequired,
  children: PropTypes.node,
  onScroll: PropTypes.func,
  servicesManager: PropTypes.object.isRequired,
};

export default OHIFVTKVrViewport;
