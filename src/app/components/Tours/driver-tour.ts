import { Coord } from '../../model/coord';
import { StateService } from '../../services/state.service';
import { InteractionService } from '../../services/interaction.service';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import {NotificationService} from "../../services/notification.service";
import {UndoRedoService} from "../../services/undo-redo.service";
import {PositionSolverService} from "../../services/kinematic-solver.service";
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
  undoRedoService: UndoRedoService,
  positionSolverService: PositionSolverService
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
    undoRedoService,
    positionSolverService
  );

  interactionService.setSelectedObject(jointInteractor);

}

export function buildTourSteps(
  stateService: StateService,
  interactionService: InteractionService,
  notificationService: NotificationService,
  undoRedoService: UndoRedoService,
  positionSovlerService: PositionSolverService
) {
  return [
    {
      popover: {
        title: 'Welcome to PMKS+',
        description: 'PMKS+ stands for Planar Mechanism Kinematic Simulator Plus. This is an analysis and synthesis tool for linkages with revolute and grounded prismatic joints.',
        position: 'center'
      }
    },
    {
      element: '#side-nav',
      popover: {
        title: 'Three Design Modes',
        description: 'PMKS+ can be used in three modes: Synthesis, Edit and Analysis. These are accessible from the side panel.',
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
        title: 'Edit',
        description: 'The Edit model allows creating a linkage by adding and editing joints and links.',
        position: 'left'
      }
    },
    {
      element: '#edit-link-panel',
      popover: {
        title: 'Edit Link',
        description:
          'Clicking on a link opens the Edit Link panel and allows editing various link properties',
        position: 'right',
        onNextClick: async (_el: any, _step: any, { driver }: any) => {
          selectJointFromCurrentLink(
            stateService,
            interactionService,
            notificationService,
            undoRedoService,
            positionSovlerService
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
        description: 'Clicking on a joint opens the Edit Joint panel and allows editing various joint properties',
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
        title: 'Synthesis',
        description: 'Synthesis panel allows users to synthesize a four-bar and a six-bar linkage using the Three Position Synthesis technique',
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
        title: 'Three Position Synthesis',
        description: 'Three positions of the coupler link can be specified using length & angle or the end points',
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
        title: 'Analysis',
        description: 'Analysis panel can be used to obtain the kinematics and forces at various joints and links.',
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
        title: 'Analysis',
        description: 'Clicking on a link or joint summarizes  results at a particular time along with the graph',
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
          'PMKS+ is able to simulate 1 degree of freedom mechanisms with revolute and grounded prismatic joints.',
        side: 'top',
        align: 'center'
      }
    },



    {
      element: '[data-tour="templates-btn"]',
      popover: { title: 'Templates', description: 'Various example linkages are available to get you started on PMKS+', side: 'bottom' },
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
      element: '[data-tour="share-btn"]',
      popover: {
        title: 'Share',
        description: 'Click here to generate a copyable URL of the linkage on the grid.',
        side: 'bottom'
      },
      allowInteractions: false
    },


    {
      element: '[data-tour="undo-redo-panel"], app-undo-redo-panel',
      popover: {
        title: 'Undo & Redo',
        description: 'These buttons allow you to undo the last action or redo a previously undone action. You can use them to revert or restore changes such as adding or removing links or joints.',
        side: 'bottom'
      },
      allowInteractions: false
    },


    {
      element: '[data-tour="settings-btn"]',
      popover: { title: 'Settings', description: 'This can be used to select appropriate unit system for creating and analyzing linkages.', side: 'bottom' },
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
      popover: { title: 'Feedback', description: 'Click here to report any bugs or issues you encounter.', side: 'bottom' },
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




