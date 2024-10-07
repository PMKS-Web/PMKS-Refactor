import { Coord } from "../model/coord";
import { Joint, JointType } from "../model/joint";
import { Mechanism } from "../model/mechanism";
import { InteractionService } from "../services/interaction.service";
import { StateService } from "../services/state.service";
import { ClickCapture, ClickCaptureID } from "./click-capture/click-capture";
import { CreateLinkFromJointCapture } from "./click-capture/create-link-from-joint-capture";
import { ContextMenuOption, Interactor } from "./interactor";

/*
This interactor defines the following behaviors:
- Dragging the joint moves it
*/

export class JointInteractor extends Interactor {
    private jointStart: Coord = new Coord(0,0);
    constructor(public joint: Joint, private stateService: StateService,
        private interactionService: InteractionService) {
        super(true, true);

        this.onDragStart$.subscribe((event) => {
            this.jointStart = this.joint._coords;
        });

        this.onDrag$.subscribe((event) => {
            this.stateService.getMechanism().setJointCoord(this.joint.id,this.jointStart.add(this.dragOffsetInModel!))
        });

        this.onDragEnd$.subscribe((event) => {
        });
        /*
        // if backspace, delete
        this.onKeyDown$.subscribe((event) => {
            if (event.key === "Backspace") {
                this.stateService.getMechanism().removeJoint(this.joint.id);
            }
        });*/

    }


    /**
     * Determines what options should be shown for the context menu when right clicking on a joint
     *
     * @returns
     */
    public override specifyContextMenu(): ContextMenuOption[] {

        let availableContext: ContextMenuOption[] = [];
        let mechanism: Mechanism = this.stateService.getMechanism();
        availableContext.push(
            {
                icon: "assets/contextMenuIcons/addLink.svg",
                label: "Attach Link",
                action: () => {this.enterAddLinkCaptureMode()},
                disabled: false
            });
            //logic for Input option
            if(this.joint.isInput){
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/removeInput.svg",
                        label: "Remove Input",
                        action: () => {mechanism.removeInput(this.joint.id)},
                        disabled: !mechanism.canRemoveInput(this.joint)
                    });
            }else{
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/addInput.svg",
                        label: "Add Input",
                        action: () => {mechanism.addInput(this.joint.id)},
                        disabled: !mechanism.canAddInput(this.joint)
                    });
            }
            //Logic for Grounding option
            if(this.joint.isGrounded){
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/removeGround.svg",
                        label: "Remove Ground",
                        action: () => {mechanism.removeGround(this.joint.id)},
                        disabled: !mechanism.canRemoveGround(this.joint)
                    });
            }else{
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/addGround.svg",
                        label: "Add Ground",
                        action: () => {mechanism.addGround(this.joint.id)},
                        disabled: !mechanism.canAddGround(this.joint)
                    });
            }
            //Logic for Slider option
            if(this.joint.type == JointType.Prismatic){
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/removeSlider.svg",
                        label: "Remove Slider",
                        action: () => {mechanism.removeSlider(this.joint.id)},
                        disabled: !mechanism.canRemoveSlider(this.joint)
                    });
            }else{
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/addSlider.svg",
                        label: "Add Slider",
                        action: () => {mechanism.addSlider(this.joint.id)},
                        disabled: !mechanism.canAddSlider(this.joint)
                    });
            }
            //Logic for Welding option
            if(this.joint.isWelded){
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/removeWeld.svg",
                        label: "Remove Weld",
                        action: () => {mechanism.removeWeld(this.joint.id)},
                        disabled: !mechanism.canRemoveWeld(this.joint)
                    });
            }else{
                availableContext.push(
                    {
                        icon: "assets/contextMenuIcons/addWeld.svg",
                        label: "Add Weld",
                        action: () => {mechanism.addWeld(this.joint.id)},
                        disabled: !mechanism.canAddWeld(this.joint)
                    });
            }
            availableContext.push(
                {
                    icon: "assets/contextMenuIcons/trash.svg",
                    label: "Delete Joint",
                    action: () => {mechanism.removeJoint(this.joint.id)},
                    disabled: false
                });
        return availableContext;

    }

    private enterAddLinkCaptureMode(): void {
        const capture = new CreateLinkFromJointCapture(this.joint, this.interactionService);
        capture.onClick$.subscribe((mousePos) => {

            if (capture.getHoveringJoint() === undefined) { // if not hovering over a joint, create a new joint to attach to
                this.stateService.getMechanism().addLinkToJoint(this.joint.id, mousePos);
            } else { // if hovering over a joint, create a link to that joint
                this.stateService.getMechanism().addLinkToJoint(this.joint.id, capture.getHoveringJoint()!.id);
            }
        });
        this.interactionService.enterClickCapture(capture);
    }

    public override toString(): string {
        return "jointInteractor(" + this.joint.name + ")";
    }

    public getJoint(): Joint {
      return this.joint ;
    }

    public override type(): string{
        return "JointInteractor"
    }
}
