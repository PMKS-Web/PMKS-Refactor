import { Coord } from '../../model/coord';
import { StateService } from '../../services/state.service';
import { InteractionService } from '../../services/interaction.service';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import {NotificationService} from "../../services/notification.service";
import {UndoRedoService} from "../../services/undo-redo.service";
import {JointInteractor} from "../../controllers/joint-interactor";
import {Joint} from "../../model/joint";
import {driver} from "driver.js";

const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));


async function spawnAndSelectLink(
  stateService: StateService,
  interactionService: InteractionService,
  notificationService: NotificationService,
  undoRedoService: UndoRedoService
) {
  const mech = stateService.getMechanism();
  const beforeIds = mech.getArrayOfLinks().map((l: any) => l.id);

  const start = new Coord(0, 0);
  const end = new Coord(3, 0);
  mech.addLink(start, end);
  mech.notifyChange?.();

  await new Promise(r => requestAnimationFrame(r));

  const created = mech.getArrayOfLinks().find((l: any) => !beforeIds.includes(l.id));
  if (!created) return;

  const linkInteractor = new LinkInteractor(
    created,
    stateService,
    interactionService,
    notificationService,
    undoRedoService
  );

  interactionService.setSelectedObject(linkInteractor);
}

function selectJointFromCurrentLink(
  stateService: StateService,
  interactionService: InteractionService,
  notificationService: NotificationService,
  undoRedoService: UndoRedoService
) {
  const selected = interactionService.getSelectedObject() as any;
  if (!selected?.link) {
    console.warn("⚠️ No link selected, cannot pick joint.");
    return;
  }

  const link = selected.link;
  const joints:Joint[]= Array.from(link.getJoints().values());
  if (joints.length === 0) {
    console.warn("⚠️ Link has no joints.");
    return;
  }

  const joint: Joint = joints[0];
  const jointInteractor = new JointInteractor(
    joint,
    stateService,
    interactionService,
    notificationService,
    undoRedoService
  );

  interactionService.setSelectedObject(jointInteractor);

}

export function buildTourSteps(
  stateService: StateService,
  interactionService: InteractionService,
  notificationService: NotificationService,
  undoRedoService: UndoRedoService
) {
  return [
    {
      popover: {
        title: 'Welcome',
        description: 'Let us show you around Planar Mechanism Kinematic Simulator Plus!',
        position: 'center'
      }
    },
    {
      element: '#side-nav',
      popover: {
        title: 'Three Modes',
        description: 'PMKS+ is divided into 3 modes: Synthesis, Editing, and Analysis.',
        position: 'right',
        onNextClick: async (_el: any, _step: any, { driver }: any) => {
          await spawnAndSelectLink(stateService,
            interactionService,
            notificationService,
            undoRedoService);
          driver.moveNext();
        },
      },
    },
    {
      element: '#sidenav-edit-button',
      popover: {
        title: 'Edit Mode',
        description: 'When in Edit mode, you can create a new link and see its joint or link properties here.',
        position: 'left'
      }
    },
    {
      element: '#edit-link-panel',
      popover: {
        title: 'Edit Link',
        description:
          'Edit Link lets you edit the selected link: length, angle, tracers, forces, etc.',
        position: 'right',
        onNextClick: async (_el: any, _step: any, { driver }: any) => {
          selectJointFromCurrentLink(
            stateService,
            interactionService,
            notificationService,
            undoRedoService
          );
          for (let i = 0; i < 20; i++) {
            const panel = document.querySelector('#edit-joint-panel');
            if (panel) break;
            await new Promise(r => setTimeout(r, 100));
          }
          driver.moveNext();
        }
      }
    },
    {
      element: '#edit-joint-panel',
      popover: {
        title: 'Edit Joint',
        description: 'Edit Joint lets you edit the selected joint: position, angle, and distance to another joint.',
        position: 'right',
        onNextClick: async (_el: any, _step: any, { driver }: any) => {
          const mech = stateService.getMechanism();

          const links = mech.getArrayOfLinks();
          mech.removeLink(links[links.length - 1].id);

          const synthBtn = document.querySelector('#sidenav-synthesis-button') as HTMLElement;
          if (synthBtn) {
            synthBtn.click();
          }

          driver.moveNext();
        }
      }
    },
    {
      element: '#sidenav-synthesis-button',
      popover: {
        title: 'Synthesis Mode',
        description: 'Synthesis Mode\'s description',
        position: 'right',
        onNextClick: async (_el: any, _step: any, { driver }: any) => {
          const subsectionCmp = (window as any).ng?.getComponent(
            document.querySelector('#three-position-synthesis-section')
          );

          if (subsectionCmp) {
            subsectionCmp.expanded = true; // force expand
            subsectionCmp.opened.emit(true);
          }
          driver.moveNext();
        }
      }
    },

    {
      element: '.app-synthesis-panel-container',
      popover: {
        title: 'Synthesis Panel',
        description: 'Synthesis Panel\'s description',
        position: 'right',
        onNextClick: async (_el: any, _step: any, { driver }: any) => {

          const analysisBtn = document.querySelector('#sidenav-analysis-button') as HTMLElement;
          if (analysisBtn) {
            analysisBtn.click();
          }

          driver.moveNext();
        }
      }
    },
    {
      element: '#sidenav-analysis-button',
      popover: {
        title: 'Analysis Mode',
        description: 'Analysis Mode\'s description',
        position: 'right',
        onNextClick: async (_el: any, _step: any, { driver }: any) => {

          const expandBtn = document.querySelector('#title-icon-button') as HTMLElement;
          if (expandBtn) {
            expandBtn.click();
          }

          driver.moveNext();
        }
      }
    },
    {
      element: '.app-analysis-panel-container',
      popover: {
        title: 'Analysis Panel',
        description: 'Analysis Panel\'s description',
        position: 'right',
        onHighlightStarted: (element: HTMLElement) => {
          // Force safe styles for complex panels like Analysis
          if (element?.id === 'default-view') {
            Object.assign(element.style, {
              position: 'static',
              transform: 'none',
              inset: 'auto',
              width: 'auto',
              height: 'auto',
              boxShadow: 'none'
            });
          }
        }
      }
    },


    {
      element: '#animationBar',
      popover: {
        title: 'Animation Bar',
        description:
          ' add description for animation bar',
        side: 'top',
        align: 'center'
      }
    },



    {
      element: '[data-tour="templates-btn"]',
      popover: { title: 'Templates', description: 'Browse starter mechanisms.', side: 'bottom' },
      onNextClick: async (_el: any, _step: any, { driver }: any) => {
        (document.querySelector('[data-tour="templates-btn"]') as HTMLElement)?.click();
        for (let i = 0; i < 40; i++) {
          if (document.querySelector('[data-tour="templates-panel"], [data-tour="templates-panel-host"]')) break;
          await new Promise(r => setTimeout(r, 50));
        }
        driver.moveNext();
      },
    },


    {
      element: '[data-tour="settings-btn"]',
      popover: { title: 'Settings', description: 'Adjust options.', side: 'bottom' },
      onNextClick: async (_el: any, _step: any, { driver }: any) => {
        (document.querySelector('[data-tour="settings-btn"]') as HTMLElement)?.click();
        for (let i = 0; i < 40; i++) {
          if (document.querySelector('[data-tour="settings-panel"]')) break;
          await new Promise(r => setTimeout(r, 50));
        }
        driver.moveNext();
      },
    },


    {
      element: '[data-tour="feedback-btn"]',
      popover: { title: 'Feedback', description: 'Send us feedback.', side: 'bottom' },
      onNextClick: async (_el: any, _step: any, { driver }: any) => {
        (document.querySelector('[data-tour="feedback-btn"]') as HTMLElement)?.click();
        for (let i = 0; i < 40; i++) {
          if (document.querySelector('[data-tour="feedback-panel"]')) break;
          await new Promise(r => setTimeout(r, 50));
        }
        driver.moveNext();
      },
    },




    {
      element: '#templatesButton',
      popover: {
        title: 'That’s it!',
        description: 'You’re ready to go—open an example linkage or start building your own.',
        position: 'right'
      }
    }
  ];
}




