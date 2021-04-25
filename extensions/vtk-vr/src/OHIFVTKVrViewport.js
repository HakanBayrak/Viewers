import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import cornerstone from 'cornerstone-core';
import OHIF from '@ohif/core';
import { getImageData, loadImageData, View3D } from '@vtk-viewport';
import presets from './presets.js';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import LoadingIndicator from './LoadingIndicator.js';

const { StackManager } = OHIF.utils;

const OHIFVTKVrViewport = props => {
  const [volumeRenderingVolumes, setVolumeRenderingVolumes] = useState(null);
  const [ctTransferFunctionPresetId, setCtTransferFunctionPresetId] = useState(
    'vtkMRMLVolumePropertyNode4'
  );
  // const [petColorMapId, setPetColorMapId] = useState('hsv');
  const [percentComplete, setPercentComplete] = useState(0);

  let apis = [];

  const saveApiReference = api => {
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

  function getShiftRange(colorTransferArray) {
    // Credit to paraview-glance
    // https://github.com/Kitware/paraview-glance/blob/3fec8eeff31e9c19ad5b6bff8e7159bd745e2ba9/src/components/controls/ColorBy/script.js#L133

    // shift range is original rgb/opacity range centered around 0
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < colorTransferArray.length; i += 4) {
      min = Math.min(min, colorTransferArray[i]);
      max = Math.max(max, colorTransferArray[i]);
    }

    const center = (max - min) / 2;

    return {
      shiftRange: [-center, center],
      min,
      max,
    };
  }

  function applyPointsToRGBFunction(points, range, cfun) {
    const width = range[1] - range[0];
    const rescaled = points.map(([x, r, g, b]) => [
      x * width + range[0],
      r,
      g,
      b,
    ]);

    cfun.removeAllPoints();
    rescaled.forEach(([x, r, g, b]) => cfun.addRGBPoint(x, r, g, b));

    return rescaled;
  }

  function applyPointsToPiecewiseFunction(points, range, pwf) {
    const width = range[1] - range[0];
    const rescaled = points.map(([x, y]) => [x * width + range[0], y]);

    pwf.removeAllPoints();
    rescaled.forEach(([x, y]) => pwf.addPoint(x, y));

    return rescaled;
  }

  const handleChangeCTTransferFunction = event => {
    const _ctTransferFunctionPresetId = event.target.value;
    const preset = presets.find(
      preset => preset.id === _ctTransferFunctionPresetId
    );

    const actor = this.state.volumeRenderingVolumes[0];

    applyPreset(actor, preset);

    this.rerenderAll();

    setCtTransferFunctionPresetId(_ctTransferFunctionPresetId);
  };

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
    [applyPreset]
  );

  const applyPreset = useCallback((actor, preset) => {
    // Create color transfer function
    const colorTransferArray = preset.colorTransfer
      .split(' ')
      .splice(1)
      .map(parseFloat);

    const { shiftRange } = getShiftRange(colorTransferArray);
    let min = shiftRange[0];
    const width = shiftRange[1] - shiftRange[0];
    const cfun = vtkColorTransferFunction.newInstance();
    const normColorTransferValuePoints = [];
    for (let i = 0; i < colorTransferArray.length; i += 4) {
      let value = colorTransferArray[i];
      const r = colorTransferArray[i + 1];
      const g = colorTransferArray[i + 2];
      const b = colorTransferArray[i + 3];

      value = (value - min) / width;
      normColorTransferValuePoints.push([value, r, g, b]);
    }

    applyPointsToRGBFunction(normColorTransferValuePoints, shiftRange, cfun);

    actor.getProperty().setRGBTransferFunction(0, cfun);

    // Create scalar opacity function
    const scalarOpacityArray = preset.scalarOpacity
      .split(' ')
      .splice(1)
      .map(parseFloat);

    const ofun = vtkPiecewiseFunction.newInstance();
    const normPoints = [];
    for (let i = 0; i < scalarOpacityArray.length; i += 2) {
      let value = scalarOpacityArray[i];
      const opacity = scalarOpacityArray[i + 1];

      value = (value - min) / width;

      normPoints.push([value, opacity]);
    }

    applyPointsToPiecewiseFunction(normPoints, shiftRange, ofun);

    actor.getProperty().setScalarOpacity(0, ofun);

    const [
      gradientMinValue,
      gradientMinOpacity,
      gradientMaxValue,
      gradientMaxOpacity,
    ] = preset.gradientOpacity
      .split(' ')
      .splice(1)
      .map(parseFloat);

    actor.getProperty().setUseGradientOpacity(0, true);
    actor.getProperty().setGradientOpacityMinimumValue(0, gradientMinValue);
    actor.getProperty().setGradientOpacityMinimumOpacity(0, gradientMinOpacity);
    actor.getProperty().setGradientOpacityMaximumValue(0, gradientMaxValue);
    actor.getProperty().setGradientOpacityMaximumOpacity(0, gradientMaxOpacity);

    if (preset.interpolation === '1') {
      actor.getProperty().setInterpolationTypeToFastLinear();
      //actor.getProperty().setInterpolationTypeToLinear()
    }

    const ambient = parseFloat(preset.ambient);
    //const shade = preset.shade === '1'
    const diffuse = parseFloat(preset.diffuse);
    const specular = parseFloat(preset.specular);
    const specularPower = parseFloat(preset.specularPower);

    //actor.getProperty().setShade(shade)
    actor.getProperty().setAmbient(ambient);
    actor.getProperty().setDiffuse(diffuse);
    actor.getProperty().setSpecular(specular);
    actor.getProperty().setSpecularPower(specularPower);
  }, []);

  const rerenderAll = useCallback(() => {
    // Update all render windows, since the automatic re-render might not
    // happen if the viewport is not currently using the painting widget
    Object.keys(this.apis).forEach(viewportIndex => {
      const renderWindow = apis[
        viewportIndex
      ].genericRenderWindow.getRenderWindow();

      renderWindow.render();
    });
  }, [apis]);

  const loadDataset = useCallback(
    (imageIds, displaySetInstanceUid) => {
      const imageDataObject = getImageData(imageIds, displaySetInstanceUid);

      loadImageData(imageDataObject);

      const numberOfFrames = imageIds.length;

      const onPixelDataInsertedCallback = numberProcessed => {
        const _percentComplete = Math.floor(
          (numberProcessed * 100) / numberOfFrames
        );

        if (percentComplete !== _percentComplete) {
          setPercentComplete(_percentComplete);
        }

        if (percentComplete % 20 === 0) {
          rerenderAll();
        }
      };

      const onAllPixelDataInsertedCallback = () => {
        rerenderAll();
      };

      imageDataObject.onPixelDataInserted(onPixelDataInsertedCallback);
      imageDataObject.onAllPixelDataInserted(onAllPixelDataInsertedCallback);

      return imageDataObject;
    },
    [percentComplete, rerenderAll]
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
    }
    return () => setPercentComplete(0);
  }, [
    createCT3dPipeline,
    ctTransferFunctionPresetId,
    loadDataset,
    props.viewportData,
    volumeRenderingVolumes,
  ]);

  const style = { width: '100%', height: '100%', position: 'relative' };

  return (
    <>
      <div style={style}>
        {!volumeRenderingVolumes && (
          <LoadingIndicator percentComplete={percentComplete} />
        )}
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
