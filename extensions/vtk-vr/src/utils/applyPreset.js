// import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
// import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import vtkLookupTableProxy from 'vtk.js/Sources/Proxy/Core/LookupTableProxy';
import vtkPiecewiseFunctionProxy from 'vtk.js/Sources/Proxy/Core/PiecewiseFunctionProxy';
import PwfProxyConstants from 'vtk.js/Sources/Proxy/Core/PiecewiseFunctionProxy/Constants';
import LookupTableProxyConstants from 'vtk.js/Sources/Proxy/Core/LookupTableProxy/Constants';

const { Mode: PwfMode } = PwfProxyConstants;

const { Mode: LookupMode } = LookupTableProxyConstants;

export const applyPresetParameters = {
  shift: 0,
  shiftRange: [],
  preset: null,
};

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
  // const width = range[1] - range[0];
  // const rescaled = points.map(([x, r, g, b]) => [
  //   x * width + range[0],
  //   r,
  //   g,
  //   b,
  // ]);

  cfun.removeAllPoints();
  points.forEach(([x, r, g, b, y, z]) => cfun.addRGBPoint(x, r, g, b, y, z));
  return points;
}

function applyPointsToPiecewiseFunction(points, range, pwf) {
  const width = range[1] - range[0];
  const rescaled = points.map(([x, y]) => [x * width + range[0], y]);

  pwf.removeAllPoints();
  rescaled.forEach(([x, y]) => pwf.addPoint(x, y));
  return rescaled;
}

export const applyPreset = (actor, pset) => {
  // Create color transfer function
  applyPresetParameters.preset = pset;
  const { preset } = applyPresetParameters;
  const colorTransferArray = preset.colorTransfer
    .split(' ')
    .splice(1)
    .map(parseFloat);

  applyPresetParameters.shiftRange = getShiftRange(
    colorTransferArray
  ).shiftRange;
  const { shiftRange } = applyPresetParameters;
  let min = shiftRange[0];
  let max = shiftRange[1];
  const width = shiftRange[1] - shiftRange[0];
  const lutProxy = vtkLookupTableProxy.newInstance();
  lutProxy.setMode(LookupMode.RGBPoints);
  const cfun = lutProxy.getLookupTable();

  const normColorTransferValuePoints = [];
  for (let i = 0; i < colorTransferArray.length; i += 4) {
    let value = colorTransferArray[i];
    const r = colorTransferArray[i + 1];
    const g = colorTransferArray[i + 2];
    const b = colorTransferArray[i + 3];

    // value = (value - min) / width;
    normColorTransferValuePoints.push([value, r, g, b, 0.5, 0.9]);
  }

  // applyPointsToRGBFunction(normColorTransferValuePoints, shiftRange, cfun);

  min += applyPresetParameters.shift;
  max += applyPresetParameters.shift;

  if (applyPresetParameters.shift !== 0) {
    lutProxy.setRGBPoints(normColorTransferValuePoints);
    lutProxy.setDataRange(min, max);
  } else {
    applyPointsToRGBFunction(normColorTransferValuePoints, shiftRange, cfun);
  }
  actor.getProperty().setRGBTransferFunction(0, cfun);
  // cfun.setMappingRange(min, max);
  // cfun.updateRange();

  // Create scalar opacity function
  const scalarOpacityArray = preset.scalarOpacity
    .split(' ')
    .splice(1)
    .map(parseFloat);
  const pwfProxy = vtkPiecewiseFunctionProxy.newInstance();
  const ofun = pwfProxy.getPiecewiseFunction();
  pwfProxy.setMode(PwfMode.Points);
  const normPoints = [];
  for (let i = 0; i < scalarOpacityArray.length; i += 2) {
    let value = scalarOpacityArray[i];
    const opacity = scalarOpacityArray[i + 1];

    value = (value - shiftRange[0]) / width;

    normPoints.push([value, opacity]);
  }

  // applyPointsToPiecewiseFunction(normPoints, shiftRange, ofun);
  // pwfProxy.setDataRange(min, max);

  if (applyPresetParameters.shift !== 0) {
    pwfProxy.setPoints(normPoints);
    pwfProxy.setDataRange(min, max);
  } else {
    applyPointsToPiecewiseFunction(normPoints, shiftRange, ofun);
  }
  actor.getProperty().setScalarOpacity(0, ofun);
  // applyPointsToPiecewiseFunction(normPoints, [min, max], ofun);

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
};
