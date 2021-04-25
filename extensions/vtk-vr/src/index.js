import React from 'react';
import { asyncComponent, retryImport } from '@ohif/ui';
import commandsModule from './commandsModule.js';
import toolbarModule from './toolbarModule.js';
import withCommandsManager from './withCommandsManager.js';

// This feels weird
// import loadLocales from './loadLocales';
const version = '1.0.0';

const OHIFVTKVRViewport = asyncComponent(() =>
  retryImport(() =>
    import(/* webpackChunkName: "OHIFVTKVRViewport" */ './OHIFVTKVRViewport.js')
  )
);

const vtkVrExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id: 'vtk-vr',
  version,

  getViewportModule({ commandsManager, servicesManager }) {
    const ExtendedVTKVRViewport = props => (
      <OHIFVTKVRViewport
        {...props}
        servicesManager={servicesManager}
        commandsManager={commandsManager}
      />
    );
    return withCommandsManager(ExtendedVTKVRViewport, commandsManager);
  },
  getToolbarModule() {
    return toolbarModule;
  },
  getCommandsModule({ commandsManager, servicesManager }) {
    return commandsModule({ commandsManager, servicesManager });
  },
};

export default vtkVrExtension;

export { vtkVrExtension };

// loadLocales();
