import {Link} from '../model/link'
import { Coord } from '../model/coord'
import {Joint} from '../model/joint'
import { Force } from '../model/force'

export class CompoundLink{
    private _id: number;
    private _name: string;
    private _mass: number;
    private _centerOfMass: Coord;
    private _links: Map<number, Link>;


    constructor(id: number, linkA: Link, linkB: Link);
    constructor(id: number, links: Link[]);
    constructor(id: number, linkAORLinks: Link | Link[], linkB?: Link){
        this._id = id;
        this._name = '';
        this._mass = 0;
        this._links = new Map();
        //currently reference to array, may need to make a deep copy later
        if(Array.isArray(linkAORLinks)){
            linkAORLinks.forEach(link =>{
                this._links.set(link.id,link);
            });
        } else if(linkB){
            this._links.set(linkAORLinks.id,linkAORLinks);
            this._links.set(linkB.id, linkB);
        } else {
            throw new Error("Invalid Constructor Parameters");
        }
        this._centerOfMass = this.calculateCenterOfMass();
    }
     //getters
    get id(): number {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get mass(): number {
        return this._mass;
    }

    get centerOfMass(): Coord {
        return this._centerOfMass;
    }
    get links(): Map<number, Link>{
        return this._links;
    }
    //setters
    set name(value: string) {
        this._name = value;
    }

    set mass(value: number) {
        this._mass = value;
    }
    //TODO: complete secondary information calculations and modifications
    calculateCenterOfMass(): Coord{
        return new Coord(0,0);
    }
    addLink(newLink: Link){
        this._links.set(newLink.id,newLink);
        this.calculateCenterOfMass();
    }
    
    removeLink(idORRef: number | Link){
        if(typeof idORRef === 'number'){
            this._links.delete(idORRef);
        } else {
            this._links.delete(idORRef.id);
        }
        this.calculateCenterOfMass();
        if(this._links.size === 1){
            throw new Error("Compound Link now only contains 1 Link");
        }
    }
    containsLink(linkID: number): boolean {
        return this._links.has(linkID);
    }

    containsJoint(jointID: number): boolean {
        for(let link of this._links.values()){
            if(link.containsJoint(jointID)){
                return true;
            }
        }
        return false;
    }

    moveCoordinates(offset: Coord): void{
        let allUniqueJoints: Set<Joint> = new Set();
        let allUniqueForces: Set<Force> = new Set();
        for(let link of this.links.values()){
            for(let joint of link.joints.values())
                allUniqueJoints.add(joint);
                for(let force of link.forces.values())
                allUniqueForces.add(force);
        }
        for(const joint of allUniqueJoints){
            joint.setCoordinates(joint.coords.add(offset));
        }
        for(const force of allUniqueForces){
            force.setCoordinates(force.start.add(offset), force.end.add(offset));
        }
    }



    compoundLinkAfterRemoveWeld(joint: Joint, idCount: number): CompoundLink[]{
        let replacementCompoundLinks: CompoundLink[] = [];
        let count:number = idCount
        //need to isolate welds, and their respective links in order to perform DFS and build all CompoundLinks
        let weldedSets: Map<Joint,Link[]> = this.getAllWeldedSets()
        console.log(weldedSets);
        weldedSets.delete(joint);
        const visitedLinks: Link[] = [];
        for(const [weldedJoint,links] of weldedSets){
            const compound: Link[] = []; 
            if(links.some(link => !visitedLinks.includes(link))){
                this.DepthFirstSearch(weldedJoint,weldedSets,compound, visitedLinks);
                replacementCompoundLinks.push(new CompoundLink(count,compound));
                count++;
            }
        }
        return replacementCompoundLinks;
    }

    private getAllWeldedSets(): Map<Joint,Link[]>{
        let sets: Map<Joint, Link[]> = new Map();
        for(let link of this._links.values()){
            for(let joint of link.joints.values()){
                if( joint.isWelded && sets.has(joint)){
                    let links: Link[] = sets.get(joint)!
                    links.push(link)
                    sets.set(joint, links);
                }else if(joint.isWelded){
                    let links: Link[] = [link];
                    sets.set(joint, links);
                }
            }
        }
        return sets;
    }

    private DepthFirstSearch(joint: Joint, sets: Map<Joint,Link[]>,compound: Link[],visited: Link[]){
        for(const link of sets.get(joint)!){
            if(!visited.includes(link)){
                visited.push(link);
                compound.push(link);
                for(const [nextJoint,links] of sets){
                    if(links.includes(link) && nextJoint !== joint)
                        this.DepthFirstSearch(nextJoint,sets,compound,visited);
                }
            }
        }
    }
   
}