import React from 'react';
import { asyncComponent, retryImport } from '@ohif/ui';
import commandsModule from './commandsModule.js';
import toolbarModule from './toolbarModule.js';

// This feels weird
// import loadLocales from './loadLocales';
const version = '1.0.0';

const OHIFVTKVrViewport = asyncComponent(() =>
  retryImport(() =>
    import(/* webpackChunkName: "OHIFVTKVRViewport" */ './OHIFVTKVrViewport.js')
  )
);

const vtkVrExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id: 'vtk_vr',
  version,

  getViewportModule({ commandsManager, servicesManager }) {
    const ExtendedVTKVRViewport = props => (
      <OHIFVTKVrViewport
        {...props}
        servicesManager={servicesManager}
        commandsManager={commandsManager}
      />
    );
    return ExtendedVTKVRViewport;
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
