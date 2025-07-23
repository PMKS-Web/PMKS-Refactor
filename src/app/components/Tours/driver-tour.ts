// src/app/tours/driver‑tour.ts
import Driver from 'driver.js';

export interface TourStep {
  element: string;
  popover: {
    title: string;
    description: string;
    position: 'top'|'bottom'|'left'|'right'|'center';
  };
}

export const DRIVER_TOUR: TourStep[] = [
  {
    element: 'app-root',
    popover: {
      title: 'Welcome',
      description: 'Let us show you around Planar Mechanism Kinematic Simulator Plus!',
      position: 'center'
    }
  },
  {
    element: '.toggle-container',
    popover: {
      title: 'Three Modes',
      description: 'PMKS+ is divided into 3 modes: Synthesis, Editing, and Analysis.',
      position: 'right'
    }
  },
  {
    element: '.grid-canvas',
    popover: {
      title: 'Edit Help',
      description: 'Right‑click on the grid to create a new link.',
      position: 'top'
    }
  },
  {
    element: '.properties-panel',
    popover: {
      title: 'Properties Panel',
      description: 'When in Edit mode, selecting a joint or link shows its properties here.',
      position: 'left'
    }
  },
  {
    element: '#helpFeedbackButton',
    popover: {
      title: 'Need More Help?',
      description: 'If you ever get stuck, click here to open the full Help & Feedback menu.',
      position: 'bottom'
    }
  },
  {
    element: '#templatesButton',
    popover: {
      title: 'Open a Template',
      description: 'Click here to open example linkages and get started quickly.',
      position: 'bottom'
    }
  },
  {
    element: '#templatesButton',
    popover: {
      title: 'That’s it!',
      description: 'You’re ready to go—open an example linkage or start building your own.',
      position: 'bottom'
    }
  }
];
