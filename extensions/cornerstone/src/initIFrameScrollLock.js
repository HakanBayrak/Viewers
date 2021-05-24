import OHIF from '@ohif/core';
import cornerstoneTools from 'cornerstone-tools';

const { studyMetadataManager } = OHIF.utils;
const { setViewportSpecificData } = OHIF.redux.actions;

const convertToVector3 = cornerstoneTools.import('util/convertToVector3');

export const initSyncronizerEvents = () => {
  if (window.location.href.includes('&s=s')) {
    window.onmessage = handleSyncronizerEvent;
  }
};

const handleSyncronizerEvent = event => {
  if (event.data && event.data.position) {
    scrollToReferanceImageIndex({
      position: event.data.position,
      orientation: event.data.orientation,
      studyUid: event.data.studyUid,
    });
  }
};

const scrollToReferanceImageIndex = ({ position, orientation, studyUid }) => {
  const state = window.store.getState();
  const { activeViewportIndex, viewportSpecificData } = state.viewports;
  const { StudyInstanceUID, displaySetInstanceUID } = viewportSpecificData[
    activeViewportIndex
  ];

  const study = studyMetadataManager.get(StudyInstanceUID);
  const { displaySets } = study;

  const displaySet = displaySets.find(
    displaySet => displaySet.displaySetInstanceUID === displaySetInstanceUID
  );
  const imageOrientation =
    displaySet.images[0]._instance.metadata.ImageOrientationPatient;
  const orientationEquel = imageOrientation.every(
    (val, index) => val === orientation[index]
  );
  if (!orientationEquel) {
    return;
  }

  const imagePosition = convertToVector3(position);
  const distances = displaySet.images.map(image => {
    const positionPatient = convertToVector3(
      image._instance.metadata.ImagePositionPatient
    );
    return imagePosition.distanceTo(positionPatient);
  });
  const shortestDistance = Math.min(...distances);
  const frameIndex = distances.indexOf(shortestDistance);
  displaySet.frameIndex = frameIndex;
  displaySet.SOPInstanceUID = displaySet.images[frameIndex].getSOPInstanceUID();

  window.store.dispatch(
    setViewportSpecificData(activeViewportIndex, displaySet)
  );

  // if (refreshViewports) {
  //   refreshCornerstoneViewports();
  // }
};
