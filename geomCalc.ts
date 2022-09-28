// Vertex2d class ->object stores 2d point coordinates
class Vertex2d {
    x: number;
    y: number;
    constructor(x: number, y: number){
        this.x = x;
        this.y = y;
    }
}
// Edge class ->object stores vertex indices
class Edge {
    i: number;
    j: number;
    side1:number;
    side2:number;
    constructor(i: number, j: number){
        this.i = i < j ? i : j;
        this.j = j > i ? j : i;
        this.side1 = -1;
        this.side2 = -1;
    }
    initSides = () =>{
        this.side1 = -1;
        this.side2 = -1;
    }
}
function symhash(i:number, j:number):number{
    //use a pairing function
    //https://en.wikipedia.org/wiki/Pairing_function
    if(i < j)
        return (1/2)*(i+j)*(i+j+1)+j;
    else
        return (1/2)*(i+j)*(i+j+1)+i;
}

function asymhash(i:number, j:number):number{
    //use a pairing function
    //https://en.wikipedia.org/wiki/Pairing_function
    return (1/2)*(i+j)*(i+j+1)+j;
}

var glPoints:Array<Vertex2d> = new Array<Vertex2d>;
var glEdges:Array<Edge> = new Array<Edge>;
var glEdgesMap: Map<number, number> = new Map();
var glPolys: Polygon2d[] = [];

// Polygon2d class: object of class stores loops which are vertex indices
// The class also initializes a rectangular bounding box enclosing the polygon 
class Polygon2d {
    id: number;
    exterior: boolean;
    private loop: number[];
    private xmin: number;
    private xmax: number;
    private ymin: number;
    private ymax: number;
    constructor(id:number, loop:number[])
    {
       this.id = id;
       this.loop = loop;
       this.exterior = false;

       if(this.loop.length > 0 && loop[this.loop.length-1] != loop[0]){
            this.loop.push(loop[0]);
       }
       if(this.loop.length < 4)
            throw Error("Definitley not a closed loop!");

       var i:number = 0;
       var j:number = 0;
       this.xmin = this.ymin =  1e+20;
       this.xmax = this.ymax = -1e+20;

       // initialize bounding box limits
       while(i < this.loop.length){

            j = this.loop[i];

            if( j < 0 || j >= glPoints.length)
                throw Error("Loop point out of index!");

            if(glPoints[j].x > this.xmax)
                this.xmax = glPoints[j].x;
            if(glPoints[j].x < this.xmin)
                this.xmin = glPoints[j].x;
            if(glPoints[j].y > this.ymax)
                this.ymax = glPoints[j].y;
            if(glPoints[j].y < this.ymin)
                this.ymin = glPoints[j].y;
            
            i++;
       }
    }
    vertexIndexAt = (i:number) : number =>{
        if(i < this.loop.length && i >= 0){
            return this.loop[i];
        }
        else
            throw Error("Out of index!");
    }
    length = ():number =>{
        return this.loop.length;
    }
    isValid = (): boolean => {
        if(this.loop.length < 4)
            return false;
        else
            return true;
    }
    isBounded = (x: number, y: number, tol: number = 1e-8) : boolean => {
        if(x>=this.xmin-tol && x<=this.xmax+tol 
            && y>=this.ymin-tol && y<=this.ymax+tol)
            return true;
        else
            return false;
    }
    isInside = (x: number, y: number, tol: number = 1e-8, radsplit: number = 8) : boolean => {
        if(!this.isBounded(x,y,tol))
            return false;
        
        var i: number;
        //doing a finer radial split for better heuristics
        var c:boolean[] = [];
        var pts:number[][] = [[]];

        for(i = 0; i < radsplit; i++){
            var ang:number = 2.0 * Math.PI * i / radsplit;

            var xy:number[] = [x + tol * Math.cos(ang), y + tol * Math.sin(ang)];
            
            pts.push(xy);

            c.push(false);
        }

        for (i = 0; i < this.loop.length-1; i++) {
            var ind_i:number = this.loop[i];
            var ind_j:number = this.loop[i+1];

            //Randalph Franklin's point in polygon algorithm
            //https://wrfranklin.org/Research/Short_Notes/pnpoly.html
            for(var j = 0; j < pts.length; j++){
                if ((((glPoints[ind_i].y <= pts[j][1]) && (pts[j][1] < glPoints[ind_j].y)) || ((glPoints[ind_j].y <= pts[j][1]) && (pts[j][1] < glPoints[ind_i].y))) &&
                    (pts[j][0] < (glPoints[ind_j].x - glPoints[ind_i].x) * (pts[j][1] - glPoints[ind_i].y) / (glPoints[ind_j].y - glPoints[ind_i].y) + glPoints[ind_i].x))
                    c[j] = !c[j];
            }
        }

        for(var i = 0; i < c.length; i++)
            if(c[i])
                return true;
        return false;
    }

    signedArea = () : number =>{

        var area: number = 0;

        for(var i = 0; i < this.loop.length-1; i++){
            var j = this.loop[i];
            var k = this.loop[i+1];
            area += ( glPoints[j].x *  glPoints[k].y - glPoints[k].x * glPoints[j].y);
        }

        return 0.5 * area;

    }

    //function return indices of neighboring polygons in the glPolys array
    calculateNeighborPolys = () : number[] => {
        var neighborset:Set<number> = new Set();

        for(var i = 0; i < this.loop.length-1; i++){
            var j = this.loop[i];
            var k = this.loop[i+1];
            
            let edgeInd = glEdgesMap.get(symhash(j, k));

            if(edgeInd == undefined)
                throw Error("Incorrect edge index!");

            var side1:number = glEdges[edgeInd].side1;
            var side2:number = glEdges[edgeInd].side2;

            if(side1>=0 && side1 != this.id)
                neighborset.add(side1);
            if(side2>=0 && side2 != this.id)
                neighborset.add(side2);
        }
        return [...neighborset];

    }

    log = () =>{
        console.log(this.id, this.loop);
    }
}

// class Graph: stores the graph of vertices and connectivity
class Graph{
    private vGraph:Array<Array<number>>;
    private eGraph:Map<string, Array<number>>;

    constructor(points:Array<Vertex2d>, edges:Array<Edge>, edgesMap: Map<number, number>){
        this.vGraph = new Array<Array<number>>;
        this.eGraph = new Map<string, Array<number>>;
        for(var i = 0; i < points.length; i++)
        {
            var blankVertices: Array<number> = new Array<number>;
            this.vGraph.push(blankVertices);
        }
        for(var i = 0; i < edges.length; i++)
        {
            this.addToVertexGraph(edges[i].i, edges[i].j);
        }
        for(var i = 0; i < edges.length; i++)
        {
            for(var k = 0; k < 2; k++){
                let index_i = k == 0 ? edges[i].i : edges[i].j;
                let index_j = k == 0 ? edges[i].j : edges[i].i;

                var leftRightVerticesIndices:number[] = this.findLeftRightVertices(index_i, index_j);
                var sortedEdgesToInsert:number[] = [];
                var edgeLeftIndex = edgesMap.get(symhash(index_j, leftRightVerticesIndices[0]));
                var edgeRightIndex = edgesMap.get(symhash(index_j, leftRightVerticesIndices[1]));

                //if edge continues then there will always be two indices to insert
                if(edgeLeftIndex != undefined && edgeRightIndex != undefined)
                {
                    sortedEdgesToInsert.push(edgeLeftIndex);

                    sortedEdgesToInsert.push(edgeRightIndex);

                    var key: string = index_i.toString() + "," + index_j.toString();

                    this.eGraph.set(key, sortedEdgesToInsert);
                }
            }
        }
    }

    private addToVertexGraph = (i:number, j:number) =>{
        if(i < 0 || i >= this.vGraph.length || j < 0 || j >= this.vGraph.length)
            throw Error("Inserting edge outside the graph range!");
        this.vGraph[i].push(j);
        this.vGraph[j].push(i);
    }

    //find left and right vertex given an edge [i,j]
    private findLeftRightVertices = (i:number, j:number) : number[] =>{
        var lrAngle:number[] = [10000.0, -10000.0];
        var lrVertices:number[] = [-1,-1];
        var k: number = 0;

        var p1: Vertex2d = glPoints[i];
        var p2: Vertex2d = glPoints[j];

        var dx1: number = p2.x - p1.x;
        var dy1: number = p2.y - p1.y;
        
        for(k = 0; k < this.vGraph[j].length; k++)
        {
            var l:number = this.vGraph[j][k];
            if(l == i)
                continue;

            var p3: Vertex2d = glPoints[l];
            
            var dx2: number = p3.x - p2.x;
            var dy2: number = p3.y - p2.y;

            var dot: number = dx1 * dx2 + dy1 * dy2;
            var det: number = dx1 * dy2 - dx2 * dy1;

            var angle: number = Math.PI - Math.atan2(det, dot);
            
            if(lrAngle[0] > angle){
                lrAngle[0] = angle;
                lrVertices[0] = l;
            }
            if(lrAngle[1] < angle){
                lrAngle[1] = angle;
                lrVertices[1] = l;
            }
        }
        return lrVertices;
    }

    //this function takes a vertex graph and 
    calculatePolygons = () => {
        
        var i: number, k: number, l: number;
        var id: number = 0;

        for (i = 0; i < glEdges.length; i++) {

            //if both side polygons been found then do not continue
            if(glEdges[i].side1 >= 0 &&  glEdges[i].side2 >= 0)
                continue;

            //k=0->go left, k=1->go right
            for(k = 0; k < 2; k++){

                var current: number = glEdges[i].i;
                var next: number = glEdges[i].j;
                var loop: number[] = [];
                
                loop.push(current);
                loop.push(next);

                while( glEdges[i].i != next ){

                    var key: string = current.toString() + "," + next.toString();

                    //find next left-right edge index
                    let nextLR = this.eGraph.get(key);

                    //if nextLR edge indices is undefined then break because there is no left or right
                    if(nextLR == undefined)
                        break;
                    
                    let edgeind = glEdgesMap.get(symhash(glEdges[nextLR[k]].i, glEdges[nextLR[k]].j));

                    if(edgeind == undefined)
                        throw Error("Incorrect edge index!");
                        
                    //if both side polygons been found then do not continue
                    if(glEdges[edgeind].side1 >= 0 &&  glEdges[edgeind].side2 >= 0)
                        break;

                    //set current to next and next to next left or right
                    current = next;
                    next = glEdges[nextLR[k]].i != next ? glEdges[nextLR[k]].i : glEdges[nextLR[k]].j;
                    
                    //add next to loop
                    loop.push(next);
                }
                if(glEdges[i].i==next && loop.length > 3)
                {
                    for(l = 0; l < loop.length-1; l++){

                        let edgeind = glEdgesMap.get(symhash(loop[l], loop[l+1]));
                        
                        if(edgeind == undefined)
                            throw Error("Incorrect edge index!");
                        
                        if(glEdges[edgeind].side1 < 0)
                            glEdges[edgeind].side1 = id;
                        else if(glEdges[edgeind].side2 < 0)
                            glEdges[edgeind].side2 = id;
                        else
                            throw Error("Edge belongs to more than 2 polygons!?!");
                    }
                    var p: Polygon2d = new Polygon2d(id++, loop);
                    var sa = p.signedArea();
                    if( (k == 0 && sa < 0) ||(k == 1 && sa > 0))
                        p.exterior = true;

                    glPolys.push(p);
                }
            }
        }
    }
}



