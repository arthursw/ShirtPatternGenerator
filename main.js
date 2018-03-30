let parameters = {
	bustSize: 96,
	waistSize: 84,
	hipSize: 99,
	collarSize: 44,
	backCollarSize: 10.1, // 7th cervical to collar point
	shoulderLength: 15.7,
	shoulderSpanBack: 39.5,
	shoulderSpanFront: 37,
	backLength: 46.6,
	armLength: 64,
	wristSize: 17.3
}

let tools = {
	exportSVG: ()=> {
		let shirtPattern = paper.project.exportSVG( { asString: true });

		// create an image, create a link to download the image, and click it
		let blob = new Blob([shirtPattern], {type: 'image/svg+xml'});
		let url = URL.createObjectURL(blob);
		let link = document.createElement("a");
		document.body.appendChild(link);
		link.download = 'patron-chemise.svg';
		link.href = url;
		link.click();
		document.body.removeChild(link);
	}
}
let applyRecursively = (item, functionToApply)=> {
	functionToApply(item)
	if(item.children != null) {
		for(let child of item.children) {
			applyRecursively(child, functionToApply)
		}	
	}
}

let saveReferenceShapesToLocalStorage = ()=> {
	let referenceShapesJSON = []
	for(let referenceShape of referenceShapes) {
		referenceShapesJSON.push({ shapes: referenceShape.shapes.exportJSON(), values: referenceShape.values })
	}
	localStorage.setItem('referenceShapes', JSON.stringify(referenceShapesJSON, null, 2))
}

let loadReferenceShapes = (referenceShapesJSON)=> {
	referenceShapeGroup.removeChildren()
	referenceShapes = []
	for(let referenceShapeJSON of referenceShapesJSON) {
		let rs = paper.project.importJSON(referenceShapeJSON.shapes)
		referenceShapeGroup.addChild(rs)
		
		for(let child of rs.children) {
			child.strokeColor = 'grey'
			child.dashArray = [2, 5, 1.5]
		}
		rs.fullySelected = false

		referenceShapes.push({ shapes: rs, values: referenceShapeJSON.values })
	}
	referenceShapeGroup.visible = debugParameters.showReferences
}

let loadReferenceShapesFromLocalStorage = ()=> {
	let referenceShapesJSON = JSON.parse(localStorage.getItem('referenceShapes')) || []
	loadReferenceShapes(referenceShapesJSON)
}

let getCurrentShape = ()=> {
	return { shapes: shapes, values: parameters }
}

let computeDistance = (shapeA, shapeB)=> {
	let distance = 0
	for(let valueName in shapeA.values) {
		if( shapeA.values[valueName] != null && shapeB.values[valueName] != null && Number.isFinite( shapeA.values[valueName] ) && Number.isFinite( shapeB.values[valueName] ) ) {
			distance += Math.abs(shapeA.values[valueName] - shapeB.values[valueName])
			if(Number.isNaN(distance)) {
				console.log(shapeA.values)
				console.log(shapeB.values)
				console.log(valueName)
				console.error('distance is NaN!!')
			}
		}
	}
	return distance
}

let debugParameters = {
	separationBetweenFrontAndBack: 10,
	BpX: 0.41,
	Bout: 1.5,
	// Jin: 2,
	// Kout: 0.6,
	EinX: 8,
	EinY: 2,
	// EightOut: 0.4,
	// ElevenIn: 0.2,
	SixInX: 10,
	SixInY: 3,
	collarTension: 0.5,
	GpX: 0.009,
	GpY: 0.5,
	GpTension: 0.56,
	showParrot: false,
	showHelpers: false,
	showReferences: true,
	showPattern: true,
	parrotRotation: 0,
	parrotScaleX: 0.85,
	parrotScaleY: 0.85,
	createReferenceShape: ()=> {
		// check if there is a reference with those values, if so delete it
		for(let i=0 ; i<referenceShapes.length ; i++) {
			let referenceShape = referenceShapes[i]
			let allValuesAreEqual = true
			for(let valueName in referenceShape.values) {
				if( referenceShape.values[valueName] != null && parameters[valueName] != null && Number.isFinite( referenceShape.values[valueName] ) && Number.isFinite( parameters[valueName] ) ) {
					if(referenceShape.values[valueName] != parameters[valueName]) {
						allValuesAreEqual = false
						break
					}
				}
			}
			if(allValuesAreEqual) {
				referenceShapes[i].shapes.remove()
				referenceShapes.splice(i, 1)
				break
			}
		}

		let clone = shapes.clone()
		referenceShapeGroup.addChild(clone)

		for(let child of clone.children) {
			child.strokeColor = 'grey'
			child.dashArray = [2, 5, 1.5]
		}
		clone.fullySelected = false
		
		let parametersCopy = {}
		for(let parameterName in parameters) {
			parametersCopy[parameterName] = parameters[parameterName]
		}
		
		let referenceShape = {shapes: clone, values: parametersCopy }
		referenceShapes.push(referenceShape)
		saveReferenceShapesToLocalStorage()
	},
	setToReferenceShape: ()=> {
		let index = referenceShapes.findIndex((s)=> selectedShape == s.shapes)
		for(let valueName in parameters) {
			parameters[valueName] = referenceShapes[index].values[valueName]
		}

		gui.updateDisplay()
		drawShapes()
		interpolateBetweenReferenceShapes()
	},
	deleteReferenceShape: ()=> {
		let index = referenceShapes.findIndex((s)=> selectedShape == s.shapes)
		if(selectedShape == referenceShapes[index].shapes) {
			selectedShape = null
		}
		referenceShapes[index].shapes.remove()
		referenceShapes.splice(index, 1)
		saveReferenceShapesToLocalStorage()
	},
	loadReferenceShapesFromLocalStorage: ()=> {
		
	},
	saveReferenceShapesToLocalStorage: ()=> {
		let json = JSON.stringify(referenceShapes)
		let blob = new Blob([json], {type: "application/json"})
		saveAs(blob, "références.json")
	}
}


var canvas = document.getElementById('canvas');
paper.setup(canvas);

let group = null
let parrot = null
let shapes = null
let referenceShapeGroup = null
let selectedShape = null

let referenceShapes = null
let referenceShapeDistanceThreshold = 2

function drawShapes(drawHelpers) {

	let reselectShapes = shapes != null && selectedShape == shapes
	
	if(group != null) {
		group.remove()
	}

	if(shapes != null) {
		shapes.remove()
	}

	group = new paper.Group()
	
	let helperGroup = new paper.Group()
	group.addChild(helperGroup)

	// Back

	let By = (1/18) * parameters.collarSize
	let FiveX = 0.25 * parameters.bustSize + 1
	let Fx = FiveX + debugParameters.separationBetweenFrontAndBack
	let Fy = By + parameters.backLength
	let F = new paper.Point(Fx, Fy)
	let Ax = Fx + 0.25 * parameters.bustSize + 1
	let A = new paper.Point(Ax, Fy)
	let B = new paper.Point(Ax, By)
	let BC = 0.5 * parameters.backLength + 2
	let Cy = By + BC
	let Dy = By + (2/3) * BC - 2
	let Gx = Ax - 0.5 * parameters.shoulderSpanBack - 1
	let DC = Cy - Dy
	let Gp = new paper.Point(Ax - (0.5 + debugParameters.GpX) * parameters.shoulderSpanBack - 1, Dy + DC * debugParameters.GpY)
	let G = new paper.Point(Gx, Dy)
	let Ex = Ax - 0.25 * parameters.bustSize - 1
	let E = new paper.Point(Ex, Cy)
	let Hx = Ax - (1/5) * parameters.collarSize
	let Bp = new paper.Point(Ax - (1/5) * parameters.collarSize * debugParameters.BpX, By)
	let J = new paper.Point(Hx, 0)
	let J1b = new paper.Point(J.x - 5, J.y + 2)
	let H = new paper.Point(Hx, By)
	let JHbisectorDirection = new paper.Point(1, -1)
	let JHbisectorVector = JHbisectorDirection.normalize().multiply( (1/20) * parameters.collarSize )
	let JHbisector = H.add(JHbisectorVector)
	
	let Kdirection = J1b.subtract(J)
	let Kvector = Kdirection.normalize().multiply( parameters.shoulderLength + 1 )
	let K = J.add(Kvector)
	let KGvector = G.subtract(K)
	let KGlength = KGvector.length

	shapes = new paper.Group()
	group.addChild(shapes)

	let backShape = new paper.Path()
	let sA = backShape.add(A)
	let sB = backShape.add(B)
	backShape.add(new paper.Segment(Bp, null, new paper.Point(-debugParameters.Bout, 0)))
	let sJ = backShape.add(J)
	// backShape.add(new paper.Segment(J, JHbisector.subtract(J).multiply(debugParameters.Jin), null))
	// backShape.add(new paper.Segment(K, null, KGvector.normalize().multiply( debugParameters.Kout ) ))
	let sK = backShape.add(K)
	let sE = backShape.add(new paper.Segment(E, new paper.Point(debugParameters.EinX, -debugParameters.EinY), null))

	// let GpSegment = backShape.add(Gp)

	// backShape.add(E)
	// GpSegment.smooth({ type: 'geometric', factor: debugParameters.GpTension })
	let sF = backShape.add(F)
	backShape.closed = true
	backShape.strokeWidth = 1
	backShape.strokeScaling = false
	backShape.strokeColor = 'black'
	shapes.addChild(backShape)

	if(drawHelpers) {

		let backShapeHelper = backShape.clone()
		backShapeHelper.strokeColor = 'green'
		helperGroup.addChild(backShapeHelper)

		let jhPath = new paper.Path()
		jhPath.add(J)
		jhPath.add(H)
		jhPath.add(JHbisector)
		jhPath.strokeWidth = 1
		jhPath.strokeScaling = false
		jhPath.strokeColor = 'green'
		helperGroup.addChild(jhPath)

		let bPath = new paper.Path()
		bPath.add(B)
		bPath.add(Fx, By)
		bPath.strokeWidth = 1
		bPath.strokeScaling = false
		bPath.strokeColor = 'green'
		helperGroup.addChild(bPath)

		let dPath = new paper.Path()
		dPath.add(Ax, Dy)
		dPath.add(Gx, Dy)
		dPath.add(Gx, Cy)
		dPath.strokeWidth = 1
		dPath.strokeScaling = false
		dPath.strokeColor = 'green'
		helperGroup.addChild(dPath)

		let cPath = new paper.Path()
		cPath.add(Ax, Cy)
		cPath.add(Fx, Cy)
		cPath.strokeWidth = 1
		cPath.strokeScaling = false
		cPath.strokeColor = 'green'
		helperGroup.addChild(cPath)
	}


	// Front

	let One = new paper.Point(0, Fy)

	let Five = new paper.Point(FiveX, Fy)
	let NineX = (1/5) * parameters.collarSize
	let Nine = new paper.Point(NineX, By)

	let ElevenY = By - 1
	let Eleven = new paper.Point(NineX, ElevenY)
	let Twelve = Eleven.add(new paper.Point(5, 2.4).normalize().multiply(parameters.shoulderLength))

	let oneFifthOfCollarSize = (1/5) * parameters.collarSize
	let EightY = oneFifthOfCollarSize
	let Eight = new paper.Point(0, EightY)
	
	let Ten = new paper.Point(NineX, EightY)
	let ThirteenDirection = new paper.Point(-1, -1)
	let ThirteenVector = ThirteenDirection.normalize().multiply( (1/9.5) * parameters.collarSize )
	let Thirteen = Ten.add(ThirteenVector)

	let SevenX = (1/2) * parameters.shoulderSpanFront + 1
	let Six = new paper.Point(FiveX, Cy)

	let frontShape = new paper.Path()
	let sOne = frontShape.add(One)
	let sEight = frontShape.add(Eight)
	// frontShape.add(new paper.Segment(Eight, null, new paper.Point(debugParameters.EightOut * oneFifthOfCollarSize, 0)))
	// frontShape.add(new paper.Segment(Thirteen, new paper.Point(-2, 2), new paper.Point(2.5, -2)))
	let ThirteenSegment = frontShape.add(Thirteen)
	

	let sEleven = frontShape.add(Eleven)
	ThirteenSegment.smooth({ type: 'geometric', factor: debugParameters.collarTension })

	// frontShape.add(new paper.Segment(Eleven, new paper.Point(0, debugParameters.ElevenIn * oneFifthOfCollarSize), null))
	let sTwelve = frontShape.add(Twelve)
	let sSix = frontShape.add(new paper.Segment(Six, new paper.Point(-debugParameters.SixInX, -debugParameters.SixInY), null))
	let sFive = frontShape.add(Five)
	frontShape.closed = true
	frontShape.strokeWidth = 1
	frontShape.strokeScaling = false
	frontShape.strokeColor = 'black'
	shapes.addChild(frontShape)


	if(drawHelpers) {
		
		let frontShapeHelper = frontShape.clone()
		frontShapeHelper.strokeColor = 'green'
		helperGroup.addChild(frontShapeHelper)

		let tenPath = new paper.Path()
		tenPath.add(Ten)
		tenPath.add(Thirteen)
		tenPath.strokeWidth = 1
		tenPath.strokeScaling = false
		tenPath.strokeColor = 'green'
		helperGroup.addChild(tenPath)
		
		let twoPath = new paper.Path()
		twoPath.add(FiveX, By)
		twoPath.add(0, By)
		twoPath.add(0, EightY)
		twoPath.add(Ten)
		twoPath.add(Eleven)
		twoPath.strokeWidth = 1
		twoPath.strokeScaling = false
		twoPath.strokeColor = 'green'
		helperGroup.addChild(twoPath)
		
		let thirteenPath = new paper.Path()
		thirteenPath.add(Ten)
		thirteenPath.add(Thirteen)
		thirteenPath.strokeWidth = 1
		thirteenPath.strokeScaling = false
		thirteenPath.strokeColor = 'green'
		helperGroup.addChild(thirteenPath)

		let threePath = new paper.Path()
		threePath.add(0, Dy)
		threePath.add(SevenX, Dy)
		threePath.add(SevenX, Cy)
		threePath.strokeWidth = 1
		threePath.strokeScaling = false
		threePath.strokeColor = 'green'
		helperGroup.addChild(threePath)

		let fourPath = new paper.Path()
		fourPath.add(0, Cy)
		fourPath.add(FiveX, Cy)
		fourPath.strokeWidth = 1
		fourPath.strokeScaling = false
		fourPath.strokeColor = 'green'
		helperGroup.addChild(fourPath)
	}


	if(reselectShapes) {
		selectedShape = shapes
		for(let child of shapes.children) {
			child.fullySelected = true
		}
	}

	for(let rs of referenceShapes) {
		rs.shapes.position = shapes.position
	}

	// Enlargement

	let enlargementGroup = new paper.Group()
	group.addChild(enlargementGroup)

	// Front

	sSix.point.x += 4
	sSix.point.y += 2.5
	sEleven.point.x += -0.5
	sTwelve.point = sTwelve.point.add(0, -0.5).add(Twelve.subtract(Eleven).normalize().multiply(2))
	sFive.point.x += 4
	sFive.point.y = By + 78
	sOne.point.y = By + 78

	let sixPath = new paper.Path()
	sixPath.add(sSix.point.clone())
	sixPath.add(sSix.point.add(-6, 0))
	enlargementGroup.addChild(sixPath)

	let overlap = 1.5
	let v1 = new paper.Path()
	v1.add(Eight.add(-overlap, 0))
	v1.add(sOne.point.add(-overlap, 0))
	enlargementGroup.addChild(v1)

	let v2 = new paper.Path()
	v2.add(v1.firstSegment.point.add(-2, 0))
	v2.add(v1.lastSegment.point.add(-2, 0))
	enlargementGroup.addChild(v2)
	
	let v3 = new paper.Path()
	v3.add(v2.firstSegment.point.add(-4, 0))
	v3.add(v2.lastSegment.point.add(-4, 0))
	enlargementGroup.addChild(v3)

	let h1 = new paper.Path()
	h1.add(v3.firstSegment.point)
	h1.add(Eight.clone())
	enlargementGroup.addChild(h1)

	let h2 = new paper.Path()
	h2.add(v3.lastSegment.point)
	h2.add(sOne.point.clone())
	enlargementGroup.addChild(h2)

	let shoulderLengthFront = sEleven.curve.length

	// Back

	sE.point.x += -4
	sE.point.y += 2.5
	sK.point = sK.point.add(0, -0.5).add(K.subtract(J).normalize().multiply(2))
	sJ.point = backShape.getPointAt(sJ.location.offset - 2)
	sK.point = sJ.point.add(sK.point.subtract(sJ.point).normalize().multiply(shoulderLengthFront))
	sF.point.x += -4
	sF.point.y = By + 78
	sA.point.y = By + 78

	let ePath = new paper.Path()
	ePath.add(sE.point.clone())
	ePath.add(sE.point.add(6, 0))
	enlargementGroup.addChild(ePath)

	let B1 = B.add(0, 6.5)

	let B1path = new paper.Path()
	B1path.add(B1)
	B1path.add(B1.x+3, B1.y)
	B1path.add(B1.x+3, sF.point.y)
	B1path.add(B.x, sF.point.y)

	let F2handleLength = (B.x - sF.point.x) / 3

	let F2path = new paper.Path()
	F2path.add(new paper.Segment(new paper.Point(sF.point.x, sF.point.y - 10), null, new paper.Point(F2handleLength, 0)))
	F2path.add(new paper.Segment(new paper.Point(Ax, sF.point.y), new paper.Point(-F2handleLength, 0), null))
	enlargementGroup.addChild(F2path)

	let FiftenPath = new paper.Path()
	FiftenPath.add(new paper.Segment(new paper.Point(sFive.point.x, sF.point.y - 10), null, new paper.Point(-F2handleLength, 0)))
	FiftenPath.add(new paper.Segment(new paper.Point(Thirteen.x, sF.point.y), new paper.Point(F2handleLength, 0), null))
	enlargementGroup.addChild(FiftenPath)

	// Pocket
	let pocket = new paper.Path()
	pocket.add(Eight.x + 7, Cy - 4)
	pocket.add(pocket.lastSegment.point.add(14, 0))
	pocket.add(pocket.lastSegment.point.add(0, 13))
	pocket.add(pocket.lastSegment.point.add(-7, 2))
	pocket.add(pocket.lastSegment.point.add(-7, -2))
	pocket.closed = true
	enlargementGroup.addChild(pocket)

	for(let child of enlargementGroup.children) {
		child.strokeWidth = 1
		child.strokeColor = 'black'
		child.strokeScaling = false
	}

	// Interpolate between reference shapes
	group.scale(10)
	interpolateBetweenReferenceShapes()
	group.scale(0.1)

	let otherSide = new paper.Group()
	for(let child of [frontShape, backShape, FiftenPath, F2path, v1, v2, v3, h1, h2]) {
		let other = child.clone()
		if(child == v3) {
			other.firstSegment.point.x += 2
			other.lastSegment.point.x += 2
		} else if(child == h1 || child == h2) {
			other.firstSegment.point.x += 2
		}

		otherSide.addChild(other)
	}
	otherSide.scaling.x = -1
	otherSide.position.x += otherSide.bounds.width
	group.addChild(otherSide)

	// Compute tangent dependent paths

	let ElevenB = frontShape.getPointAt(sEleven.location.offset - 2.5)
	let TwelveB = frontShape.getPointAt(sTwelve.location.offset + 3.5)
	
	let ElevenBPath = new paper.Path()
	ElevenBPath.add(ElevenB)
	ElevenBPath.add(TwelveB)
	enlargementGroup.addChild(ElevenBPath)

	let bPath = new paper.Path()
	bPath.add(B1)
	bPath.add(sF.point.x, B1.y)
	enlargementGroup.addChild(bPath)

	let bPathIntersections = bPath.getIntersections(backShape)
	let minX = Number.MAX_VALUE
	let K2 = null
	for(let intersection of bPathIntersections) {
		if(intersection.point.x < minX) {
			minX = intersection.point.x
			K2 = intersection.point
		}
	}

	bPath.lastSegment.point.x = K2.x

	let bPath2 = new paper.Path()
	bPath2.add(new paper.Segment(K2.add(6, 0), null, new paper.Point(-4, 0) ))
	bPath2.add(K2.x, K2.y + 1)
	enlargementGroup.addChild(bPath2)

	// Sleeve

	let sleeveHelpers = new paper.Group()
	sleeveHelpers.visible = drawHelpers
	helperGroup.addChild(sleeveHelpers)

	let frontSleeveLength = sTwelve.curve.length
	let backSleeveLength = sK.curve.length
	let sleeveDepth = sSix.point.y - (sK.point.y + sTwelve.point.y) / 2

	let sleeveX = sB.point.x + 5
	let sleeveLeftWidth = 0.75 * frontSleeveLength
	let sleeveRightWidth = 0.75 * backSleeveLength

	let sleeveA = new paper.Point(sleeveX + sleeveLeftWidth, 0)
	let sleeveTopHeight = sleeveDepth - sleeveDepth / 5
	let sleeveB = new paper.Point(sleeveA.x, sleeveA.y + sleeveTopHeight)
	let sleeveC = new paper.Point(sleeveA.x, sleeveA.y + parameters.armLength)
	let sleeveD = sleeveB.add(sleeveRightWidth, 0)
	let sleeveE = sleeveB.add(-sleeveLeftWidth, 0)
	let sleeveWristWidth = parameters.wristSize + 4
	let sleeveG = sleeveC.add(-sleeveWristWidth/2, 0)
	let sleeveF = sleeveC.add(sleeveWristWidth/2, 0)

	let sleeveVerticalPath = new paper.Path()
	sleeveVerticalPath.add(sleeveA)
	sleeveVerticalPath.add(sleeveC)
	sleeveHelpers.addChild(sleeveVerticalPath)

	let sleeveHorizontalPath = new paper.Path()
	sleeveHorizontalPath.add(sleeveE)
	sleeveHorizontalPath.add(sleeveD)
	sleeveHelpers.addChild(sleeveHorizontalPath)

	let sleeveEAD = new paper.Path()
	sleeveEAD.add(sleeveE)
	sleeveEAD.add(sleeveA)
	sleeveEAD.add(sleeveD)
	sleeveHelpers.addChild(sleeveEAD)

	let sleeveE1vector = new paper.Point(0, -Math.max(sleeveLeftWidth, sleeveTopHeight))
	sleeveE1vector.angle -= 45

	let sleeveE1path = new paper.Path()
	sleeveE1path.add(sleeveB)
	sleeveE1path.add(sleeveB.add(sleeveE1vector))
	sleeveHelpers.addChild(sleeveE1path)

	let sleeveE1Intersections = sleeveE1path.getIntersections(sleeveEAD)
	let sleeveE1 = sleeveE1Intersections[0].point
	let sleeveE1Offset = sleeveE1path.getPointAt(sleeveE1path.getOffsetOf(sleeveE1) + 1)

	let sleeveD1vector = new paper.Point(0, -Math.max(sleeveLeftWidth, sleeveTopHeight))
	sleeveD1vector.angle += 45

	let sleeveD1path = new paper.Path()
	sleeveD1path.add(sleeveB)
	sleeveD1path.add(sleeveB.add(sleeveD1vector))
	sleeveHelpers.addChild(sleeveD1path)

	let sleeveD1Intersections = sleeveD1path.getIntersections(sleeveEAD)
	let sleeveD1 = sleeveD1Intersections[0].point
	let sleeveD1Offset = sleeveD1path.getPointAt(sleeveD1path.getOffsetOf(sleeveD1) + 1.5)

	let sleeveE2 = sleeveE.add(sleeveE1).multiply(0.5)
	let sleeveD2 = sleeveD.add(sleeveD1).multiply(0.5)
	let sleeveA1 = sleeveA.add(sleeveB).multiply(0.5)

	let sleeveE2Offset = sleeveE2.add(sleeveB.subtract(sleeveE2).normalize().multiply(0.8))

	let sleeveD4 = sleeveD.add(sleeveD2).multiply(0.5)
	let sleeveD4vector = sleeveD2.subtract(sleeveD).normalize().multiply(0.5)
	sleeveD4vector.angle -= 90
	let sleeveD4Offset = sleeveD4.add(sleeveD4vector)

	let sleeveE3path = new paper.Path()
	sleeveE3path.add(sleeveA1)
	sleeveE3path.add(sleeveA1.add(sleeveE1vector))
	sleeveHelpers.addChild(sleeveE3path)

	let sleeveE3Intersections = sleeveE3path.getIntersections(sleeveEAD)
	let sleeveE3 = sleeveE3Intersections[0].point
	let sleeveE3Offset = sleeveE3path.getPointAt(sleeveE3path.getOffsetOf(sleeveE3) + 2)

	let sleeveD3path = new paper.Path()
	sleeveD3path.add(sleeveA1)
	sleeveD3path.add(sleeveA1.add(sleeveD1vector))
	sleeveHelpers.addChild(sleeveD3path)

	let sleeveD3Intersections = sleeveD3path.getIntersections(sleeveEAD)
	let sleeveD3 = sleeveD3Intersections[0].point
	let sleeveD3Offset = sleeveD3path.getPointAt(sleeveD3path.getOffsetOf(sleeveD3) + 1.8)

	// let sleeveBottom = new paper.Path()
	// let sbSD = sleeveBottom.add(sleeveD)
	// sleeveBottom.add(sleeveF)
	// sleeveBottom.add(sleeveG)
	// let sbSE = sleeveBottom.add(sleeveE)
	
	let sleeveTop = new paper.Path()
	let stSE = sleeveTop.add(sleeveE)
	let stSE2 = sleeveTop.add(sleeveE2Offset)
	let stSE1 = sleeveTop.add(sleeveE1Offset)
	sleeveTop.add(sleeveE3Offset)
	let sleeveSA = sleeveTop.add(sleeveA)
	sleeveTop.add(sleeveD3Offset)
	sleeveTop.add(sleeveD1Offset)
	sleeveTop.add(sleeveD2)
	sleeveTop.add(sleeveD4Offset)
	let stSD = sleeveTop.add(sleeveD)
	sleeveTop.smooth()

	let sleeveBackTop = sleeveTop.splitAt(sleeveSA.location)
	let sleeveFrontTop = sleeveTop

	let sleeveBackBottom = new paper.Path()
	sleeveBackBottom.add(sleeveD)
	sleeveBackBottom.add(sleeveF)
	sleeveBackBottom.add(sleeveC)

	let sleeveFrontBottom = new paper.Path()
	sleeveFrontBottom.add(sleeveE)
	sleeveFrontBottom.add(sleeveG)
	sleeveFrontBottom.add(sleeveC)

	let DToAIsAboutBackSleeveLength = (length)=> {
		return length >= backSleeveLength && length < backSleeveLength + 1.2
	}

	let length = sleeveBackTop.length
	let n = 0
	while ( ! DToAIsAboutBackSleeveLength(length) ) {
		if(length < backSleeveLength) {
			sleeveBackTop.bounds.width += 0.1
		} else if (length >= backSleeveLength + 1.2) {
			sleeveBackTop.bounds.width -= 0.1
		}
		sleeveBackTop.bounds.left = sleeveA.x
		sleeveBackBottom.firstSegment.point.x = sleeveBackTop.bounds.right
		length = sleeveBackTop.length
		if( n > 100) {
			console.error('Unable to set proper sleeve length')
			break
		}
		n++
	}

	let EToAIsAboutFrontSleeveLength = (length)=> {
		return length >= frontSleeveLength && length < frontSleeveLength + 1.2
	}

	length = sleeveFrontTop.length
	n = 0
	while ( !EToAIsAboutFrontSleeveLength(length) ) {
		if(length < frontSleeveLength) {
			sleeveFrontTop.bounds.width += 0.1
		} else if (length >= frontSleeveLength + 1.2) {
			sleeveFrontTop.bounds.width -= 0.1
		}
		sleeveFrontTop.bounds.right = sleeveA.x
		sleeveFrontBottom.firstSegment.point.x = sleeveFrontTop.bounds.left
		length = sleeveFrontTop.length
		if( n > 100) {
			console.error('Unable to set proper sleeve length')
			break
		}
		n++
	}

	for(let child of sleeveHelpers.children) {
		child.strokeWidth = 1
		child.strokeColor = 'green'
	}
	
	let sleeve = new paper.Group()
	group.addChild(sleeve)

	for(let child of [sleeveFrontTop, sleeveFrontBottom, sleeveBackTop, sleeveBackBottom]) {
		child.strokeWidth = 1
		child.strokeColor = 'black'
		sleeve.addChild(child)
	}

	let sleeveDelta = sleeve.position.clone()
	sleeve.position.x = sOne.point.x + sleeve.bounds.width / 2
	sleeve.position.y = sOne.point.y + sleeve.bounds.height / 2 + 2
	
	sleeveDelta = sleeve.position.subtract(sleeveDelta)

	sleeveHelpers.position = sleeveHelpers.position.add(sleeveDelta)

	let otherSleeve = sleeve.clone()
	otherSleeve.scaling.x = -1
	otherSleeve.bounds.left = sleeve.bounds.right + 2

	// Collar 

	let collarA = ()=> {
		let collarFooterHeight = 3.5
		let collarSpacingY = 2
		let collarFallHeight = 4.5

		let frontCollarSize = parameters.collarSize / 2
		let backCollarSize = parameters.backCollarSize

		let collarTopLeft = new paper.Point(otherSleeve.bounds.right + 2, sleeve.bounds.top + 2)

		let C = collarTopLeft.add(2, collarFallHeight + collarSpacingY + collarFooterHeight)
		let BC = 0.5 * frontCollarSize + overlap
		let B = C.add(BC, 0)
		let B1 = B.add(0, -collarFooterHeight)
		let A = B.add(backCollarSize, 0)
		let D = A.add(0, -collarFooterHeight)
		let J = D.add(0, -collarSpacingY)
		let K = J.add(0, -collarFallHeight)
		let F = C.add(0.5, -1.5)
		let G = F.add(1.4, -1.4)
		let H = G.add(1.9, -0.5)
		let M = H.add(0, -0.2)
		let L = J.add(-backCollarSize, 0)
		let L1 = K.add(-backCollarSize, 0)
		let N = new paper.Point(M.x, K.y)
		let O = new paper.Point(C.x-0.5, K.y-0.5)

		let collarTop = new paper.Path()
		collarTop.add(O)
		collarTop.add(new paper.Segment(L1, new paper.Point(-BC*0.66, 0), null))
		collarTop.add(K)
		collarTop.add(J)
		collarTop.add(new paper.Segment(L, null, new paper.Point(-BC*0.25, 0)))
		collarTop.add(M)

		let collarBottom = new paper.Path()
		collarBottom.add(A)
		collarBottom.add(new paper.Segment(B, null, new paper.Point(-0.5 * BC, 0)))
		collarBottom.add(F)
		collarBottom.add(G)
		collarBottom.add(new paper.Segment(H, null, new paper.Point(0.2 * BC, -1)))
		collarBottom.add(new paper.Segment(B1, new paper.Point(-1, 0), null))
		collarBottom.add(D)

		let collarHpath = new paper.Path()
		let offsetOfH = collarBottom.getOffsetOf(H)
		collarHpath.add( collarBottom.getPointAt(offsetOfH - 0.1) )
		collarHpath.add( H.add(0, 0.15) )
		collarHpath.add( collarBottom.getPointAt(offsetOfH + 0.1) )

		let collarBpath = new paper.Path()
		let offsetOfB = collarBottom.getOffsetOf(B)
		collarBpath.add( collarBottom.getPointAt(offsetOfB - 0.2) )
		collarBpath.add( B.add(0, -0.2) )
		collarBpath.add( collarBottom.getPointAt(offsetOfB + 0.2) )

		for(let child of [collarTop, collarBottom, collarHpath, collarBpath]) {
			child.strokeWidth = 1
			child.strokeColor = 'black'
			child.closed = true
			group.addChild(child)

			let childB = child.clone()
			let distance = A.x - child.bounds.right

			childB.scaling.x = -1

			childB.bounds.left = A.x + distance
		}
	}

	collarA()


	let collarB = ()=> {
		let collarFooterHeight = 3.5
		let collarSpacingY = 2
		let collarFallHeight = 4.5

		let frontCollarSize = parameters.collarSize / 2
		let backCollarSize = parameters.backCollarSize

		let collarTopLeft = new paper.Point(otherSleeve.bounds.right + 2, sleeve.bounds.top + 2 + collarFallHeight + collarSpacingY + collarFooterHeight)

		let C = collarTopLeft.add(4, 4 + collarFallHeight + collarFooterHeight)
		let BC = 0.5 * frontCollarSize + overlap
		let B = C.add(BC, 0)
		// let L = B.add(0, - collarFooterHeight - collarFallHeight)
		let A = B.add(backCollarSize, 0)
		let D = A.add(0, - collarFooterHeight - collarFallHeight)
		let F = C.add(-0.1, -2)
		let H = F.add(2, -2)
		let M = H.add(0, -0.2)
		let O = new paper.Point(C.x-0.5, D.y-3)
		let P = C.add(BC/2, 0.5)

		let collar = new paper.Path()
		collar.add(A)
		collar.add(new paper.Segment(D, null, new paper.Point(-BC*0.66, 0)))
		collar.add(O)
		collar.add(new paper.Segment(H, null, new paper.Point(-1.5, 0)))
		collar.add(new paper.Segment(F, new paper.Point(0, -1.5), null))
		collar.add(new paper.Segment(P, new paper.Point(-2, 0), new paper.Point(2, 0)))
		collar.add(new paper.Segment(B, new paper.Point(-2, 0), null))

		let collarB = new paper.Path()
		let offsetOfB = collar.getOffsetOf(B)
		collarB.add( collar.getPointAt(offsetOfB - 0.2) )
		collarB.add( B.add(0, -0.2) )
		collarB.add( B )

		for(let child of [collar, collarB]) {
			child.strokeWidth = 1
			child.strokeColor = 'black'
			child.closed = true
			group.addChild(child)

			let childB = child.clone()
			let distance = A.x - child.bounds.right

			childB.scaling.x = -1

			childB.bounds.left = A.x + distance
		}
	}

	collarB()

	group.scale(10)

	for(let referenceShape of referenceShapes) {
		referenceShape.shapes.position = shapes.position
	}
}

function interpolateBetweenReferenceShapes() {

	// Interpolate between all referenceShapes

	// find three closest referenceShapes
	
	if(referenceShapes.length > 1) {

		let shapeDistances = []

		for(let s of referenceShapes) {
			let currentShape = getCurrentShape()
			shapeDistances.push( { distance: computeDistance(s, currentShape), shape: s })
		}

		shapeDistances.sort( (a, b) => a.distance - b.distance )

		let d1 = shapeDistances[0].distance
		let d2 = shapeDistances[1].distance
		let d3 = 0 // shapeDistances[2] ? shapeDistances[2].distance : 0

		let maxDistance = d1 + d2 + d3

		let childIndex = 0
		for(let child of shapes.children) {
			for(let segment of child.segments) {
				let s1 = shapeDistances[0].shape.shapes.children[childIndex].segments[segment.index]
				let s2 = shapeDistances[1].shape.shapes.children[childIndex].segments[segment.index]
				//let s3 = shapeDistances[2] ? shapeDistances[2].shape.shapes[1].children[childIndex][1].segments[segment.index] : null
				if(!segment.handleIn.isZero()) {
					let handle1 = s1.handleIn
					let handle2 = s2.handleIn
					// let handle3 = s3 ? new paper.Point(s3[1]) : new paper.Point(0, 0)
					let handle = maxDistance > 0 ?
								 handle1.multiply(1 - d1 / maxDistance)
							.add(handle2.multiply(1 - d2 / maxDistance)) : handle1
					//		.add(handle3.multiply(1 - d3 / maxDistance)) : handle1
					segment.handleIn = handle
					// console.log(d1, d2, d3)
					// console.log(handle1, handle2, handle3)
					// console.log(handle)
				}
				if(!segment.handleOut.isZero()) {
					let handle1 = s1.handleOut
					let handle2 = s2.handleOut
					// let handle3 = s3 ? new paper.Point(s3[2]) : new paper.Point(0, 0)
					let handle = maxDistance > 0 ?
								 handle1.multiply(1 - d1 / maxDistance)
							.add(handle2.multiply(1 - d2 / maxDistance)) : handle1
					//		.add(handle3.multiply(1 - d3 / maxDistance)) : handle1
					segment.handleOut = handle
					// console.log(d1, d2, d3)
					// console.log(handle1, handle2, handle3)
					// console.log(handle)
				}
			}
			childIndex++
		}
	}
}

function initialize() {

	
	referenceShapeGroup = new paper.Group()

	paper.project.importSVG('Parrot.svg', { onLoad: (item, url)=> {
		parrot = new paper.Group()
		parrot.addChild(item)

		let arrows = new paper.Group()
		let rotationArrow = new paper.Group()
		let scaleArrow = new paper.Group()

		rotationArrow.name = 'parrot-rotation-arrow'
		let arcRadius = 50
		let arc = new paper.Path.Circle(item.position, arcRadius)

		let arcLength = 15
		let arrowHeadLength = 4
		let tangentTop = arc.getTangentAt(arcLength / 2)
		let tangentBottom = arc.getTangentAt(arc.length - arcLength / 2)

		let aTopTop = new paper.Path()
		aTopTop.add(arc.getPointAt(arcLength / 2))
		aTopTop.add(aTopTop.lastSegment.point.add(tangentTop.multiply(-arrowHeadLength).rotate(45)))

		let aTopBottom = new paper.Path()
		aTopBottom.add(arc.getPointAt(arcLength / 2))
		aTopBottom.add(aTopBottom.lastSegment.point.add(tangentTop.multiply(-arrowHeadLength).rotate(-45)))

		let aBottomTop = new paper.Path()
		aBottomTop.add(arc.getPointAt(arc.length - arcLength / 2))
		aBottomTop.add(aBottomTop.lastSegment.point.add(tangentBottom.multiply(arrowHeadLength).rotate(45)))

		let aBottomBottom = new paper.Path()
		aBottomBottom.add(arc.getPointAt(arc.length - arcLength / 2))
		aBottomBottom.add(aBottomBottom.lastSegment.point.add(tangentBottom.multiply(arrowHeadLength).rotate(-45)))

		rotationArrow.addChild(aTopTop)
		rotationArrow.addChild(aTopBottom)
		rotationArrow.addChild(aBottomTop)
		rotationArrow.addChild(aBottomBottom)

		arc.splitAt(arc.length - arcLength / 2)
		let toRemove = arc.splitAt(arcLength)
		toRemove.remove()
		rotationArrow.addChild(arc)

		let centerCircle = new paper.Path.Circle(item.position, 1)
		rotationArrow.addChild(centerCircle)

		let centerToArc = new paper.Path()
		let scaleArrowLength = 0.3
		centerToArc.add(item.position.add(new paper.Point(-arcRadius * scaleArrowLength,0)))
		centerToArc.add(item.position.add(new paper.Point(-arcRadius * (1-scaleArrowLength),0)))
		scaleArrow.addChild(centerToArc)

		let scaleArrowHeadLength = 2
		let leftScaleArrow = new paper.Path()
		leftScaleArrow.add(centerToArc.lastSegment.point.add(scaleArrowHeadLength, scaleArrowHeadLength))
		leftScaleArrow.add(centerToArc.lastSegment.point)
		leftScaleArrow.add(centerToArc.lastSegment.point.add(scaleArrowHeadLength, -scaleArrowHeadLength))

		scaleArrow.addChild(leftScaleArrow)

		let rightScaleArrow = new paper.Path()
		rightScaleArrow.add(centerToArc.firstSegment.point.add(-scaleArrowHeadLength, scaleArrowHeadLength))
		rightScaleArrow.add(centerToArc.firstSegment.point)
		rightScaleArrow.add(centerToArc.firstSegment.point.add(-scaleArrowHeadLength, -scaleArrowHeadLength))

		scaleArrow.addChild(rightScaleArrow)

		for(let child of scaleArrow.children.concat(rotationArrow.children)) {
			child.strokeColor = 'black'
			child.strokeWidth = 0.5
		}

		arrows.addChild(rotationArrow)
		arrows.addChild(scaleArrow)

		parrot.addChild(arrows)
		parrot.data.rotationArrow = rotationArrow
		parrot.data.scaleArrow = scaleArrow

		parrot.position = group.position
		parrot.applyMatrix = false
		parrot.scaling.x = debugParameters.parrotScaleX
		parrot.scaling.y = debugParameters.parrotScaleY
		parrot.visible = debugParameters.showParrot
	}})

	loadReferenceShapesFromLocalStorage()
}

function draw() {
	

	drawShapes(debugParameters.showHelpers)
	

	let margin = 10
	groupBounds = group.bounds.expand(margin)
	// group.fitBounds(paper.view.bounds.expand(-50))


	// if(viewRatio > shapeRatio) {
	// 	let h = group.bounds.height
	// 	let w = h * viewRatio
	// 	paper.view.size = new paper.Size(w, h)
	// } else {
	// 	let w = group.bounds.width
	// 	let h = w / viewRatio
	// 	paper.view.size = new paper.Size(w, h)
	// }

	paper.view.zoom = 1

	let viewRatio = paper.view.bounds.width / paper.view.bounds.height
	let shapeRatio = groupBounds.width / groupBounds.height

	if(viewRatio > shapeRatio) {
		paper.view.zoom = paper.view.bounds.height / groupBounds.height
	} else {
		paper.view.zoom = paper.view.bounds.width / groupBounds.width
	}

	paper.view.center = groupBounds.center

	shapes.visible = debugParameters.showPattern
}

let selectedSegment = null;
let selectedSegmentType = null;


paper.view.onMouseDown = (event)=> {
	selectedSegment = null;
	selectedSegmentType = null;
	
	// applyRecursively(parrot, (item)=> item.selected = true)
	
	var hitResult = parrot.hitTest(event.point, {
			segments: true,
			handles: true,
			fill: true,
			tolerance: 5
		});

	parrot.data.rotating = false
	parrot.data.dragging = false

	// Parrot
	if (hitResult && (hitResult.item == parrot || parrot.isAncestor(hitResult.item))) {

		if(parrot.data.rotationArrow == hitResult.item || parrot.data.rotationArrow.isAncestor(hitResult.item)) {
			parrot.data.rotating = true
		} else if(parrot.data.scaleArrow == hitResult.item || parrot.data.scaleArrow.isAncestor(hitResult.item)) {
			// parrot.applyMatrix = true
			parrot.scale(-1, 1)
			// parrot.applyMatrix = false
		} else {
			parrot.data.dragging = true
		}
		return
	}

	// Shapes
	hitResult = shapes.hitTest(event.point, {
			stroke: true,
			handles: true,
			tolerance: 5
		});

	if(hitResult) {
		if(selectedShape != shapes) {
			if(selectedShape != null) {
				selectedShape.fullySelected = false
			}
			selectedShape = shapes
			shapes.fullySelected = true
		} else if ( hitResult.type == 'handle-in' || hitResult.type == 'handle-out' ) {
			selectedSegment = hitResult.segment;
			selectedSegmentType = hitResult.type;
		}
		return
	}

	// References
	hitResult = referenceShapeGroup.hitTest(event.point, {
			stroke: true,
			handles: true,
			tolerance: 5
		})

	// Select reference shape if hitResult
	if(hitResult) {
		let referenceShape = null
		for(let child of referenceShapeGroup.children) {
			if(child == hitResult.item || child.isAncestor(hitResult.item)) {
				if(selectedShape != child) {
					if(selectedShape != null) {
						selectedShape.fullySelected = false
					}
					child.fullySelected = true
					selectedShape = child
					return
				}
				break
			}
		}

		if( ( hitResult.type == 'handle-in' || hitResult.type == 'handle-out') && (selectedShape == hitResult.item || selectedShape.isAncestor(hitResult.item)) ) {
			selectedSegment = hitResult.segment;
			selectedSegmentType = hitResult.type;
			return
		}
	} else {
		if(selectedShape != null) {
			selectedShape.fullySelected = false
		}
		selectedShape = null
	}

}

paper.view.onMouseMove = (event)=> {
}

paper.view.onMouseDrag = (event)=>{
	if(selectedSegment) {
		if(selectedSegmentType == 'handle-in') {
			selectedSegment.handleIn = selectedSegment.handleIn.add(event.delta)
		} else if (selectedSegmentType == 'handle-out') {
			selectedSegment.handleOut = selectedSegment.handleOut.add(event.delta)
		}

		if(referenceShapeGroup.isAncestor(selectedShape)) {
			interpolateBetweenReferenceShapes()
			saveReferenceShapesToLocalStorage()
		}
	}
	if(parrot.data.dragging) {
		parrot.position = parrot.position.add(event.delta)
	} else if(parrot.data.rotating) {
		parrot.rotation = event.point.subtract(parrot.position).angle + 180
	}
}

paper.view.onResize = ()=> {
	displayGeneratingAndDraw()
}

window.addEventListener("resize", displayGeneratingAndDraw);

function displayGeneratingAndDraw() {
	draw();
}

function onDocumentDrag(event) {
	event.preventDefault();
}

function onDocumentDrop(event) {
	event.preventDefault();

	var file = event.dataTransfer.files[0];
	var reader = new FileReader();

	reader.onload = function (event) {
		var image = document.createElement('img');
		image.onload = function () {
			raster = new paper.Raster(image);
		};
		image.src = event.target.result;
	};
	reader.readAsDataURL(file);
}

document.addEventListener('drop', onDocumentDrop, false);
document.addEventListener('dragover', onDocumentDrag, false);
document.addEventListener('dragleave', onDocumentDrag, false);

dat.GUI.DEFAULT_WIDTH = '100%';
var gui = new dat.GUI({autoPlace: false});
var customContainer = document.getElementById('gui');
customContainer.appendChild(gui.domElement);

gui.add(parameters, 'bustSize', 84, 120).name('Tour de poitrine').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'waistSize', 72, 108).name('Tour de taille').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'hipSize', 89, 117).name('Tour de bassin').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'collarSize', 41.9, 48.2).name('Tour bas encolure').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'backCollarSize', 9.5, 11.3).name('Long. 7em cerv. encolure').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'shoulderLength', 14.7, 16.4).name('Long. d\'épaule').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'shoulderSpanBack', 36.2, 46).name('Carrure dos').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'shoulderSpanFront', 33.7, 43.5).name('Carrure devant').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'backLength', 43, 47.8).name('Long. taille dos').onChange(displayGeneratingAndDraw);
gui.add(parameters, 'armLength', 60, 64).name('Long. bras').onChange(displayGeneratingAndDraw);


let folder = gui.addFolder('Admin.')

// folder.add(debugParameters, 'BpX', 0, 10).onChange(displayGeneratingAndDraw);
// folder.add(debugParameters, 'Bout', 0, 10).onChange(displayGeneratingAndDraw);
// // folder.add(debugParameters, 'Jin', 0, 10).onChange(displayGeneratingAndDraw);
// // folder.add(debugParameters, 'Kout', 0, 10).onChange(displayGeneratingAndDraw);
// // folder.add(debugParameters, 'Ein', 0, 10).onChange(displayGeneratingAndDraw);
// // folder.add(debugParameters, 'EightOut', 0, 10).onChange(displayGeneratingAndDraw);
// // folder.add(debugParameters, 'ElevenIn', 0, 10).onChange(displayGeneratingAndDraw);
// folder.add(debugParameters, 'SixInX', 0, 20).onChange(displayGeneratingAndDraw);
// folder.add(debugParameters, 'SixInY', 0, 10).onChange(displayGeneratingAndDraw);

// folder.add(debugParameters, 'collarTension', 0, 1).onChange(displayGeneratingAndDraw);
// folder.add(debugParameters, 'GpX', 0, 1).onChange(displayGeneratingAndDraw);
// folder.add(debugParameters, 'GpY', 0, 1).onChange(displayGeneratingAndDraw);
// folder.add(debugParameters, 'GpTension', 0, 1).onChange(displayGeneratingAndDraw);

folder.add(debugParameters, 'separationBetweenFrontAndBack', 0, 20).name('Séparation').onChange(displayGeneratingAndDraw);

folder.add(debugParameters, 'showParrot').onChange((value)=>{
	parrot.visible = value
}).name('Voir perroquet');
folder.add(debugParameters, 'showHelpers').onChange((value)=>{
	displayGeneratingAndDraw()
}).name('Tracers d\'aides');
folder.add(debugParameters, 'showReferences').onChange((value)=>{
	referenceShapeGroup.visible = value
	displayGeneratingAndDraw()
}).name('Voir références');
folder.add(debugParameters, 'showPattern').onChange((value)=>{
	displayGeneratingAndDraw()
}).name('Voir patron');
folder.add(debugParameters, 'parrotRotation', 0, 360).onChange((value)=>{
	parrot.rotation = value
}).name('Rot. perroquet');
folder.add(debugParameters, 'parrotScaleX', -1, 1).onChange((value)=>{
	parrot.scaling.x = value
}).name('Taille X perroquet');
folder.add(debugParameters, 'parrotScaleY', -1, 1).onChange((value)=>{
	parrot.scaling.y = value
}).name('Taille Y perroquet');


let createReferenceShapeButton = folder.add(debugParameters, 'createReferenceShape').name('Creer une référence');
let setReferenceShapeButton = folder.add(debugParameters, 'setToReferenceShape').name('Régler aux valeurs de la référence');
let deleteReferenceShapeButton = folder.add(debugParameters, 'deleteReferenceShape').name('Supprimer la référence');

let createLoadReferencesButton = ()=> {

	// Import SVG to add shapes
	let divJ = $("<input data-name='file-selector' type='file' class='form-control' name='file[]'  accept='json'/>")

	let importJSON = (event)=> {
		referenceShapes = JSON.parse(event.target.result)
		loadReferenceShapes(referenceShapes)
		// referenceShapeGroup.removeChildren()
		// save to local storage and display changes
		saveReferenceShapesToLocalStorage()
		// loadReferenceShapesFromLocalStorage()
		displayGeneratingAndDraw()
	}

	let handleFileSelect = (event) => {
		let files = event.dataTransfer != null ? event.dataTransfer.files : event.target.files

		for (let i = 0; i < files.length; i++) {
			let file = files.item(i)
			
			let imageType = /^application\/json/

			if (!imageType.test(file.type)) {
				continue
			}

			let reader = new FileReader()
			reader.onload = (event)=> importJSON(event)
			reader.readAsText(file)
		}
	}

	let loadReferencesButton = folder.add({ loadReferences: ()=> {
		divJ.click()
	} }, 'loadReferences').name('Charger les références...')

	divJ.click((event)=>{
		event.stopPropagation()
		return -1;
	})
	$(loadReferencesButton.domElement).append(divJ)
	

	divJ.on('change', handleFileSelect)
	divJ.hide()
}

createLoadReferencesButton()

folder.add(debugParameters, 'saveReferenceShapesToLocalStorage').name('Enregistrer les références...')
			

gui.add(tools, 'exportSVG').name('Exporter en SVG');

initialize();
displayGeneratingAndDraw();
