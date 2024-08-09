import { Injectable } from '@angular/core';
import Driver, {driver} from 'driver.js';
import 'driver.js/dist/driver.min.css';

@Injectable ({providedIn: 'root'})
export class DriverService {
}

const driverObj = driver ({
  showProgress: true,
  steps: [{
    popover: {
      title: 'Welcome',
      description: 'This pop-up tutorial will guide you through various features of Planar Mechanism Kinematic Simulator Plus (PMKS+).'
    }
  }, {element: '.side-nav',
    popover: {
      title: 'Usage Modes of PMKS+ ',
      description: 'PMKS+ has three major usage modes: Synthesis, Edit and Analysis.',
      side: "left",
      align: 'start'
    }
  }, {element: '.sidenav-button.selected',
    popover: {
      title: 'Edit Mode ',
      description: 'Clicking Edit will allow creating and editing linkages on the grid.',
      side: "left",
      align: 'start'
    }
  }, {element: '.app-edit-panel-container',
    popover: {
      title: 'Edit Panel ',
      description: 'Joint, Link and Force properties will be displayed and edited from this panel while creating linkages on the grid.',
      side: "left",
      align: 'center'
    }
  }, {element: '.side-nav',
    popover: {
      title: 'Synthesis and Analysis Modes ',
      description: 'Three Position Synthesis has been integrated into PMKS+. Analysis mode showcases results of kinematic and force analyses.',
      side: "left",
      align: 'start'
    }
  }, {element: '#animationBarPlaySpeed',
    popover: {
      title: 'Animation Controller ',
      description: 'Animate any valid mechanisms and control the speed of animation using these buttons.',
      side: "top",
      align: "center"
    }
  }, {element: '#animationBarTimeSlider',
    popover: {
      title: 'Time and Slider ',
      description: 'Adjust the slider to display the position of the mechanism at that time step. Specific time step can also be specified in the textbox.',
      side: "top",
      align: "center"
    }
  }, {element: '#viewButtons',
    popover: {
      title: 'Display Options',
      description: 'Display the center of mass and labels of joints and links using these buttons. To adjust the size, zoom options are also available.',
      side: "top",
      align: "center"
    }
  }, {element: '#synthesisPanel',
    popover: {
      title: 'Synthesis Panel',
      description: 'Here is the Synthesis Panel. It should be visible now.',
      side: 'left',
      align: 'start'
    }
  }, {element: '#threePositionSynthesis',
    popover: {
      title: 'Three Position Synthesis',
      description: 'This is the Three Position Synthesis section. It should be expanded now.',
      side: 'top',
      align: 'center'
    }
  },]
});
driverObj.drive ();
