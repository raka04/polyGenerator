"use strict";
// Vertex2d class ->object stores 2d point coordinates
class Vertex2d {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
// Edge class ->object stores vertex indices
class Edge {
    constructor(i, j) {
        this.initSides = () => {
            this.side1 = -1;
            this.side2 = -1;
        };
        this.i = i < j ? i : j;
        this.j = j > i ? j : i;
        this.side1 = -1;
        this.side2 = -1;
    }
}
function symhash(i, j) {
    //use a pairing function
    //https://en.wikipedia.org/wiki/Pairing_function
    if (i < j)
        return (1 / 2) * (i + j) * (i + j + 1) + j;
    else
        return (1 / 2) * (i + j) * (i + j + 1) + i;
}
function asymhash(i, j) {
    //use a pairing function
    //https://en.wikipedia.org/wiki/Pairing_function
    return (1 / 2) * (i + j) * (i + j + 1) + j;
}
var glPoints = new Array;
var glEdges = new Array;
var glPolys = [];
// Polygon2d class: object of class stores loops which are vertex indices
// The class also initializes a rectangular bounding box enclosing the polygon 
class Polygon2d {
    constructor(id, loop) {
        this.vertexIndexAt = (i) => {
            if (i < this.loop.length && i >= 0) {
                return this.loop[i];
            }
            else
                throw Error("Out of index!");
        };
        this.length = () => {
            return this.loop.length;
        };
        this.isValid = () => {
            if (this.loop.length < 4)
                return false;
            else
                return true;
        };
        this.isBounded = (x, y, tol = 1e-8) => {
            if (x >= this.xmin - tol && x <= this.xmax + tol
                && y >= this.ymin - tol && y <= this.ymax + tol)
                return true;
            else
                return false;
        };
        this.isInside = (x, y, tol = 1e-8) => {
            if (!this.isBounded(x, y, tol))
                return false;
            var i;
            var c = false;
            //Randalph Franklin's point in polygon algorithm
            //https://wrfranklin.org/Research/Short_Notes/pnpoly.html
            // Complexity->O(N)
            for (i = 0; i < this.loop.length - 1; i++) {
                var ind_i = this.loop[i];
                var ind_j = this.loop[i + 1];
                if ((((glPoints[ind_i].y <= y) && (y < glPoints[ind_j].y)) || ((glPoints[ind_j].y <= y) && (y < glPoints[ind_i].y))) &&
                    (x < (glPoints[ind_j].x - glPoints[ind_i].x) * (y - glPoints[ind_i].y) / (glPoints[ind_j].y - glPoints[ind_i].y) + glPoints[ind_i].x))
                    c = !c;
            }
            return c;
        };
        this.signedArea = () => {
            var area = 0;
            // Complexity->O(N)
            for (var i = 0; i < this.loop.length - 1; i++) {
                var j = this.loop[i];
                var k = this.loop[i + 1];
                area += (glPoints[j].x * glPoints[k].y - glPoints[k].x * glPoints[j].y);
            }
            return 0.5 * area;
        };
        this.log = () => {
            console.log(this.id, this.loop);
        };
        this.id = id;
        this.loop = loop;
        this.exterior = false;
        if (this.loop.length > 0 && loop[this.loop.length - 1] != loop[0]) {
            this.loop.push(loop[0]);
        }
        if (this.loop.length < 4)
            throw Error("Definitley not a closed loop!");
        var i = 0;
        var j = 0;
        this.xmin = this.ymin = 1e+20;
        this.xmax = this.ymax = -1e+20;
        // initialize bounding box limits
        // Complexity->O(N)
        while (i < this.loop.length) {
            j = this.loop[i];
            if (j < 0 || j >= glPoints.length)
                throw Error("Loop point out of index!");
            if (glPoints[j].x > this.xmax)
                this.xmax = glPoints[j].x;
            if (glPoints[j].x < this.xmin)
                this.xmin = glPoints[j].x;
            if (glPoints[j].y > this.ymax)
                this.ymax = glPoints[j].y;
            if (glPoints[j].y < this.ymin)
                this.ymin = glPoints[j].y;
            i++;
        }
    }
}
// class Graph: stores the graph of vertices and connectivity
class Graph {
    constructor(points, edges) {
        this.addToVertexGraph = (i, j) => {
            //O(1)
            this.vGraph[i].push(j);
            this.vGraph[j].push(i);
        };
        //find left and right vertex given an edge [i,j]
        this.findLeftRightVertices = (i, j) => {
            var lrAngle = [10000.0, -10000.0];
            var lrVertices = [-1, -1];
            var k = 0;
            var p1 = glPoints[i];
            var p2 = glPoints[j];
            var dx1 = p2.x - p1.x;
            var dy1 = p2.y - p1.y;
            //O(N)
            for (k = 0; k < this.vGraph[j].length; k++) {
                var l = this.vGraph[j][k];
                if (l == i)
                    continue;
                var p3 = glPoints[l];
                var dx2 = p3.x - p2.x;
                var dy2 = p3.y - p2.y;
                var dot = dx1 * dx2 + dy1 * dy2;
                var det = dx1 * dy2 - dx2 * dy1;
                var angle = Math.PI - Math.atan2(det, dot);
                if (lrAngle[0] > angle) {
                    lrAngle[0] = angle;
                    lrVertices[0] = l;
                }
                if (lrAngle[1] < angle) {
                    lrAngle[1] = angle;
                    lrVertices[1] = l;
                }
            }
            return lrVertices;
        };
        //this function takes a vertex graph and 
        this.calculatePolygons = () => {
            var i, k, l;
            var id = 0;
            // Complexity->O((f1*N+f2*N...+fN*N)) = (0(N * (f1+f2+f3...))) ~(O(N^2)) 
            for (i = 0; i < glEdges.length; i++) {
                //if both side polygons been found then do not continue
                if (glEdges[i].side1 >= 0 && glEdges[i].side2 >= 0)
                    continue;
                //k=0->go left, k=1->go right
                for (k = 0; k < 2; k++) {
                    var current = glEdges[i].i;
                    var next = glEdges[i].j;
                    var loop = [];
                    loop.push(current);
                    loop.push(next);
                    while (glEdges[i].i != next) {
                        var key = current.toString() + "," + next.toString();
                        //find next left-right edge index
                        let nextLR = this.eGraph.get(key);
                        //if nextLR edge indices is undefined then break because there is no left or right
                        if (nextLR == undefined)
                            break;
                        let edgeind = this.edgeIndexMap.get(symhash(glEdges[nextLR[k]].i, glEdges[nextLR[k]].j));
                        if (edgeind == undefined)
                            throw Error("Incorrect edge index!");
                        //if both side polygons been found then do not continue
                        if (glEdges[edgeind].side1 >= 0 && glEdges[edgeind].side2 >= 0)
                            break;
                        //set current to next and next to next left or right
                        current = next;
                        next = glEdges[nextLR[k]].i != next ? glEdges[nextLR[k]].i : glEdges[nextLR[k]].j;
                        //add next to loop
                        loop.push(next);
                    }
                    if (glEdges[i].i == next && loop.length > 3) {
                        for (l = 0; l < loop.length - 1; l++) {
                            let edgeind = this.edgeIndexMap.get(symhash(loop[l], loop[l + 1]));
                            if (edgeind == undefined)
                                throw Error("Incorrect edge index!");
                            if (glEdges[edgeind].side1 < 0)
                                glEdges[edgeind].side1 = id;
                            else if (glEdges[edgeind].side2 < 0)
                                glEdges[edgeind].side2 = id;
                            else
                                throw Error("Edge belongs to more than 2 polygons!?!");
                        }
                        var p = new Polygon2d(id++, loop);
                        var sa = p.signedArea();
                        if ((k == 0 && sa < 0) || (k == 1 && sa > 0))
                            p.exterior = true;
                        glPolys.push(p);
                    }
                }
            }
        };
        //function return indices of neighboring polygons in the glPolys array
        this.calculateNeighborPolys = (poly) => {
            var neighborset = new Set();
            // Complexity->O(N)
            for (var i = 0; i < poly.length() - 1; i++) {
                var j = poly.vertexIndexAt(i);
                var k = poly.vertexIndexAt(i + 1);
                let edgeInd = this.edgeIndexMap.get(symhash(j, k));
                if (edgeInd == undefined)
                    throw Error("Incorrect edge index!");
                var side1 = glEdges[edgeInd].side1;
                var side2 = glEdges[edgeInd].side2;
                if (side1 >= 0 && side1 != poly.id)
                    neighborset.add(side1);
                if (side2 >= 0 && side2 != poly.id)
                    neighborset.add(side2);
            }
            return [...neighborset];
        };
        this.vGraph = new Array;
        this.eGraph = new Map;
        this.edgeIndexMap = new Map;
        // Complexity->O(N) 
        for (var i = 0; i < points.length; i++) {
            var blankVertices = new Array;
            this.vGraph.push(blankVertices);
        }
        // Complexity->O(N)
        for (var i = 0; i < edges.length; i++) {
            this.addToVertexGraph(edges[i].i, edges[i].j);
            this.edgeIndexMap.set(symhash(edges[i].i, edges[i].j), i);
        }
        // Complexity->O((f1*N+f2*N...+fN*N)) = (0(N * (f1+f2+f3...))) ~(O(N^2)) 
        for (var i = 0; i < edges.length; i++) {
            for (var k = 0; k < 2; k++) {
                let index_i = k == 0 ? edges[i].i : edges[i].j;
                let index_j = k == 0 ? edges[i].j : edges[i].i;
                var leftRightVerticesIndices = this.findLeftRightVertices(index_i, index_j);
                var sortedEdgesToInsert = [];
                var edgeLeftIndex = this.edgeIndexMap.get(symhash(index_j, leftRightVerticesIndices[0]));
                var edgeRightIndex = this.edgeIndexMap.get(symhash(index_j, leftRightVerticesIndices[1]));
                //if edge continues then there will always be two indices to insert
                if (edgeLeftIndex != undefined && edgeRightIndex != undefined) {
                    sortedEdgesToInsert.push(edgeLeftIndex);
                    sortedEdgesToInsert.push(edgeRightIndex);
                    var key = index_i.toString() + "," + index_j.toString();
                    this.eGraph.set(key, sortedEdgesToInsert);
                }
            }
        }
    }
}
