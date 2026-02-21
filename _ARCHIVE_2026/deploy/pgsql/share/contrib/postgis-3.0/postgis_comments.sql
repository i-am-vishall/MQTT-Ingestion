
	COMMENT ON TYPE box2d IS 'postgis type: A 2-dimensional bounding box. Used to describe the 2D extent of a geometry or collection of geometries.';

	COMMENT ON TYPE box3d IS 'postgis type: A 3-dimensional bounding box. Used to describe the 3D extent of a geometry or collection of geometries.';

	COMMENT ON TYPE geometry IS 'postgis type: The type representing spatial features with planar coordinate systems.';

	COMMENT ON TYPE geometry_dump IS 'postgis type: A composite type used to describe the parts of complex geometry.';

	COMMENT ON TYPE geography IS 'postgis type: The type representing spatial features with geodetic (ellipsoidal) coordinate systems.';

COMMENT ON FUNCTION AddGeometryColumn(varchar , varchar , integer , varchar , integer , boolean ) IS 'args: table_name, column_name, srid, type, dimension, use_typmod=true - Adds a geometry column to an existing table.';
			
COMMENT ON FUNCTION AddGeometryColumn(varchar , varchar , varchar , integer , varchar , integer , boolean ) IS 'args: schema_name, table_name, column_name, srid, type, dimension, use_typmod=true - Adds a geometry column to an existing table.';
			
COMMENT ON FUNCTION AddGeometryColumn(varchar , varchar , varchar , varchar , integer , varchar , integer , boolean ) IS 'args: catalog_name, schema_name, table_name, column_name, srid, type, dimension, use_typmod=true - Adds a geometry column to an existing table.';
			
COMMENT ON FUNCTION DropGeometryColumn(varchar , varchar ) IS 'args: table_name, column_name - Removes a geometry column from a spatial table.';
			
COMMENT ON FUNCTION DropGeometryColumn(varchar , varchar , varchar ) IS 'args: schema_name, table_name, column_name - Removes a geometry column from a spatial table.';
			
COMMENT ON FUNCTION DropGeometryColumn(varchar , varchar , varchar , varchar ) IS 'args: catalog_name, schema_name, table_name, column_name - Removes a geometry column from a spatial table.';
			
COMMENT ON FUNCTION DropGeometryTable(varchar ) IS 'args: table_name - Drops a table and all its references in geometry_columns.';
			
COMMENT ON FUNCTION DropGeometryTable(varchar , varchar ) IS 'args: schema_name, table_name - Drops a table and all its references in geometry_columns.';
			
COMMENT ON FUNCTION DropGeometryTable(varchar , varchar , varchar ) IS 'args: catalog_name, schema_name, table_name - Drops a table and all its references in geometry_columns.';
			
COMMENT ON FUNCTION Find_SRID(varchar , varchar , varchar ) IS 'args: a_schema_name, a_table_name, a_geomfield_name - Returns the SRID defined for a geometry column.';
			
COMMENT ON FUNCTION Populate_Geometry_Columns(boolean ) IS 'args: use_typmod=true - Ensures geometry columns are defined with type modifiers or have appropriate spatial constraints.';
			
COMMENT ON FUNCTION Populate_Geometry_Columns(oid, boolean ) IS 'args: relation_oid, use_typmod=true - Ensures geometry columns are defined with type modifiers or have appropriate spatial constraints.';
			
COMMENT ON FUNCTION UpdateGeometrySRID(varchar , varchar , integer ) IS 'args: table_name, column_name, srid - Updates the SRID of all features in a geometry column, and the table metadata.';
			
COMMENT ON FUNCTION UpdateGeometrySRID(varchar , varchar , varchar , integer ) IS 'args: schema_name, table_name, column_name, srid - Updates the SRID of all features in a geometry column, and the table metadata.';
			
COMMENT ON FUNCTION UpdateGeometrySRID(varchar , varchar , varchar , varchar , integer ) IS 'args: catalog_name, schema_name, table_name, column_name, srid - Updates the SRID of all features in a geometry column, and the table metadata.';
			
COMMENT ON FUNCTION ST_Collect(geometry, geometry) IS 'args: g1, g2 - Creates a GeometryCollection or Multi* geometry from a set of geometries.';
			
COMMENT ON FUNCTION ST_Collect(geometry[]) IS 'args: g1_array - Creates a GeometryCollection or Multi* geometry from a set of geometries.';
			
COMMENT ON AGGREGATE ST_Collect(geometry) IS 'args: g1field - Creates a GeometryCollection or Multi* geometry from a set of geometries.';
			
COMMENT ON FUNCTION ST_LineFromMultiPoint(geometry ) IS 'args: aMultiPoint - Creates a LineString from a MultiPoint geometry.';
			
COMMENT ON FUNCTION ST_MakeEnvelope(float, float, float, float, integer) IS 'args: xmin, ymin, xmax, ymax, srid=unknown - Creates a rectangular Polygon from minimum and maximum coordinates.';
			
COMMENT ON FUNCTION ST_MakeLine(geometry, geometry) IS 'args: geom1, geom2 - Creates a Linestring from Point, MultiPoint, or LineString geometries.';
			
COMMENT ON FUNCTION ST_MakeLine(geometry[]) IS 'args: geoms_array - Creates a Linestring from Point, MultiPoint, or LineString geometries.';
			
COMMENT ON AGGREGATE ST_MakeLine(geometry) IS 'args: geoms - Creates a Linestring from Point, MultiPoint, or LineString geometries.';
			
COMMENT ON FUNCTION ST_MakePoint(float, float) IS 'args: x, y - Creates a 2D, 3DZ or 4D Point.';
			
COMMENT ON FUNCTION ST_MakePoint(float, float, float) IS 'args: x, y, z - Creates a 2D, 3DZ or 4D Point.';
			
COMMENT ON FUNCTION ST_MakePoint(float, float, float, float) IS 'args: x, y, z, m - Creates a 2D, 3DZ or 4D Point.';
			
COMMENT ON FUNCTION ST_MakePointM(float, float, float) IS 'args: x, y, m - Creates a Point from X, Y and M values.';
			
COMMENT ON FUNCTION ST_MakePolygon(geometry) IS 'args: linestring - Creates a Polygon from a shell and optional list of holes.';
			
COMMENT ON FUNCTION ST_MakePolygon(geometry, geometry[]) IS 'args: outerlinestring, interiorlinestrings - Creates a Polygon from a shell and optional list of holes.';
			
COMMENT ON FUNCTION ST_Point(float, float) IS 'args: x, y - Creates a Point with the given coordinate values. Alias for ST_MakePoint.';
			
COMMENT ON FUNCTION ST_Polygon(geometry , integer ) IS 'args: lineString, srid - Creates a Polygon from a LineString with a specified SRID.';
			
COMMENT ON FUNCTION ST_TileEnvelope(integer, integer, integer, geometry) IS 'args: tileZoom, tileX, tileY, bounds=SRID=3857;LINESTRING(-20037508.342789 -20037508.342789,20037508.342789 20037508.342789) - Creates a rectangular Polygon in Web Mercator (SRID:3857) using the XYZ tile system.';
			
COMMENT ON FUNCTION GeometryType(geometry ) IS 'args: geomA - Returns the type of a geometry as text.';
			
COMMENT ON FUNCTION ST_Boundary(geometry ) IS 'args: geomA - Returns the boundary of a geometry.';
			
COMMENT ON FUNCTION ST_CoordDim(geometry ) IS 'args: geomA - Return the coordinate dimension of a geometry.';
			
COMMENT ON FUNCTION ST_Dimension(geometry ) IS 'args: g - Returns the topological dimension of a geometry.';
			
COMMENT ON FUNCTION ST_Dump(geometry ) IS 'args: g1 - Returns a set of geometry_dump rows for the components of a geometry.';
			
COMMENT ON FUNCTION ST_DumpPoints(geometry ) IS 'args: geom - Returns a set of geometry_dump rows for the points in a geometry.';
			
COMMENT ON FUNCTION ST_DumpRings(geometry ) IS 'args: a_polygon - Returns a set of geometry_dump rows for the exterior and interior rings of a Polygon.';
			
COMMENT ON FUNCTION ST_EndPoint(geometry ) IS 'args: g - Returns the last point of a LineString or CircularLineString.';
			
COMMENT ON FUNCTION ST_Envelope(geometry ) IS 'args: g1 - Returns a geometry representing the bounding box of a geometry.';
			
COMMENT ON FUNCTION ST_BoundingDiagonal(geometry , boolean ) IS 'args: geom, fits=false - Returns the diagonal of a geometrys bounding box.';
			
COMMENT ON FUNCTION ST_ExteriorRing(geometry ) IS 'args: a_polygon - Returns a LineString representing the exterior ring of a Polygon.';
			
COMMENT ON FUNCTION ST_GeometryN(geometry , integer ) IS 'args: geomA, n - Return the Nth geometry element of a geometry collection.';
			
COMMENT ON FUNCTION ST_GeometryType(geometry ) IS 'args: g1 - Returns the SQL-MM type of a geometry as text.';
			
COMMENT ON FUNCTION ST_HasArc(geometry ) IS 'args: geomA - Tests if a geometry contains a circular arc';
			
COMMENT ON FUNCTION ST_InteriorRingN(geometry , integer ) IS 'args: a_polygon, n - Returns the Nth interior ring (hole) of a Polygon.';
			
COMMENT ON FUNCTION ST_IsPolygonCCW(geometry) IS 'args: geom - Tests if Polygons have exterior rings oriented counter-clockwise and interior rings oriented clockwise.';
			
COMMENT ON FUNCTION ST_IsPolygonCW(geometry) IS 'args: geom - Tests if Polygons have exterior rings oriented clockwise and interior rings oriented counter-clockwise.';
			
COMMENT ON FUNCTION ST_IsClosed(geometry ) IS 'args: g - Tests if a LineStringss start and end points are coincident. For a PolyhedralSurface tests if it is closed (volumetric).';
			
COMMENT ON FUNCTION ST_IsCollection(geometry ) IS 'args: g - Tests if a geometry is a geometry collection type.';
			
COMMENT ON FUNCTION ST_IsEmpty(geometry ) IS 'args: geomA - Tests if a geometry is empty.';
			
COMMENT ON FUNCTION ST_IsRing(geometry ) IS 'args: g - Tests if a LineString is closed and simple.';
			
COMMENT ON FUNCTION ST_IsSimple(geometry ) IS 'args: geomA - Tests if a geometry has no points of self-intersection or self-tangency.';
			
COMMENT ON FUNCTION ST_M(geometry ) IS 'args: a_point - Returns the M coordinate of a Point.';
			
COMMENT ON FUNCTION ST_MemSize(geometry ) IS 'args: geomA - Returns the amount of memory space a geometry takes.';
			
COMMENT ON FUNCTION ST_NDims(geometry ) IS 'args: g1 - Returns the coordinate dimension of a geometry.';
			
COMMENT ON FUNCTION ST_NPoints(geometry ) IS 'args: g1 - Returns the number of points (vertices) in a geometry.';
			
COMMENT ON FUNCTION ST_NRings(geometry ) IS 'args: geomA - Returns the number of rings in a polygonal geometry.';
			
COMMENT ON FUNCTION ST_NumGeometries(geometry ) IS 'args: geom - Returns the number of elements in a geometry collection.';
			
COMMENT ON FUNCTION ST_NumInteriorRings(geometry ) IS 'args: a_polygon - Returns the number of interior rings (holes) of a Polygon.';
			
COMMENT ON FUNCTION ST_NumInteriorRing(geometry ) IS 'args: a_polygon - Returns the number of interior rings (holes) of a Polygon. Aias for ST_NumInteriorRings';
			
COMMENT ON FUNCTION ST_NumPatches(geometry ) IS 'args: g1 - Return the number of faces on a Polyhedral Surface. Will return null for non-polyhedral geometries.';
			
COMMENT ON FUNCTION ST_NumPoints(geometry ) IS 'args: g1 - Returns the number of points in a LineString or CircularString.';
			
COMMENT ON FUNCTION ST_PatchN(geometry , integer ) IS 'args: geomA, n - Returns the Nth geometry (face) of a PolyhedralSurface.';
			
COMMENT ON FUNCTION ST_PointN(geometry , integer ) IS 'args: a_linestring, n - Returns the Nth point in the first LineString or circular LineString in a geometry.';
			
COMMENT ON FUNCTION ST_Points(geometry) IS 'args: geom - Returns a MultiPoint containing all the coordinates of a geometry.';
			
COMMENT ON FUNCTION ST_StartPoint(geometry ) IS 'args: geomA - Returns the first point of a LineString.';
			
COMMENT ON FUNCTION ST_Summary(geometry ) IS 'args: g - Returns a text summary of the contents of a geometry.';
			
COMMENT ON FUNCTION ST_Summary(geography ) IS 'args: g - Returns a text summary of the contents of a geometry.';
			
COMMENT ON FUNCTION ST_X(geometry ) IS 'args: a_point - Returns the X coordinate of a Point.';
			
COMMENT ON FUNCTION ST_Y(geometry ) IS 'args: a_point - Returns the Y coordinate of a Point.';
			
COMMENT ON FUNCTION ST_Z(geometry ) IS 'args: a_point - Returns the Z coordinate of a Point.';
			
COMMENT ON FUNCTION ST_Zmflag(geometry ) IS 'args: geomA - Returns a code indicating the ZM coordinate dimension of a geometry.';
			
COMMENT ON FUNCTION ST_AddPoint(geometry, geometry) IS 'args: linestring, point - Add a point to a LineString.';
			
COMMENT ON FUNCTION ST_AddPoint(geometry, geometry, integer) IS 'args: linestring, point, position - Add a point to a LineString.';
			
COMMENT ON FUNCTION ST_CollectionExtract(geometry , integer ) IS 'args: collection, type - Given a (multi)geometry, return a (multi)geometry consisting only of elements of the specified type.';
			
COMMENT ON FUNCTION ST_CollectionHomogenize(geometry ) IS 'args: collection - Given a geometry collection, return the "simplest" representation of the contents.';
			
COMMENT ON FUNCTION ST_Force2D(geometry ) IS 'args: geomA - Force the geometries into a "2-dimensional mode".';
			
COMMENT ON FUNCTION ST_Force3D(geometry ) IS 'args: geomA - Force the geometries into XYZ mode. This is an alias for ST_Force3DZ.';
			
COMMENT ON FUNCTION ST_Force3DZ(geometry ) IS 'args: geomA - Force the geometries into XYZ mode.';
			
COMMENT ON FUNCTION ST_Force3DM(geometry ) IS 'args: geomA - Force the geometries into XYM mode.';
			
COMMENT ON FUNCTION ST_Force4D(geometry ) IS 'args: geomA - Force the geometries into XYZM mode.';
			
COMMENT ON FUNCTION ST_ForcePolygonCCW(geometry) IS 'args: geom - Orients all exterior rings counter-clockwise and all interior rings clockwise.';
			
COMMENT ON FUNCTION ST_ForceCollection(geometry ) IS 'args: geomA - Convert the geometry into a GEOMETRYCOLLECTION.';
			
COMMENT ON FUNCTION ST_ForcePolygonCW(geometry) IS 'args: geom - Orients all exterior rings clockwise and all interior rings counter-clockwise.';
			
COMMENT ON FUNCTION ST_ForceSFS(geometry ) IS 'args: geomA - Force the geometries to use SFS 1.1 geometry types only.';
			
COMMENT ON FUNCTION ST_ForceSFS(geometry , text ) IS 'args: geomA, version - Force the geometries to use SFS 1.1 geometry types only.';
			
COMMENT ON FUNCTION ST_ForceRHR(geometry) IS 'args: g - Force the orientation of the vertices in a polygon to follow the Right-Hand-Rule.';
			
COMMENT ON FUNCTION ST_ForceCurve(geometry) IS 'args: g - Upcast a geometry into its curved type, if applicable.';
			
COMMENT ON FUNCTION ST_LineMerge(geometry ) IS 'args: amultilinestring - Return a (set of) LineString(s) formed by sewing together a MULTILINESTRING.';
			
COMMENT ON FUNCTION ST_Multi(geometry ) IS 'args: g1 - Return the geometry as a MULTI* geometry.';
			
COMMENT ON FUNCTION ST_Normalize(geometry ) IS 'args: geom - Return the geometry in its canonical form.';
			
COMMENT ON FUNCTION ST_QuantizeCoordinates(geometry, int, int, int, int) IS 'args: g, prec_x, prec_y, prec_z, prec_m - Sets least significant bits of coordinates to zero';
			
COMMENT ON FUNCTION ST_RemovePoint(geometry, integer) IS 'args: linestring, offset - Remove point from a linestring.';
			
COMMENT ON FUNCTION ST_Reverse(geometry ) IS 'args: g1 - Return the geometry with vertex order reversed.';
			
COMMENT ON FUNCTION ST_Segmentize(geometry , float ) IS 'args: geom, max_segment_length - Return a modified geometry/geography having no segment longer than the given distance.';
			
COMMENT ON FUNCTION ST_Segmentize(geography , float ) IS 'args: geog, max_segment_length - Return a modified geometry/geography having no segment longer than the given distance.';
			
COMMENT ON FUNCTION ST_SetPoint(geometry, integer, geometry) IS 'args: linestring, zerobasedposition, point - Replace point of a linestring with a given point.';
			
COMMENT ON FUNCTION ST_SnapToGrid(geometry , float , float , float , float ) IS 'args: geomA, originX, originY, sizeX, sizeY - Snap all points of the input geometry to a regular grid.';
			
COMMENT ON FUNCTION ST_SnapToGrid(geometry , float , float ) IS 'args: geomA, sizeX, sizeY - Snap all points of the input geometry to a regular grid.';
			
COMMENT ON FUNCTION ST_SnapToGrid(geometry , float ) IS 'args: geomA, size - Snap all points of the input geometry to a regular grid.';
			
COMMENT ON FUNCTION ST_SnapToGrid(geometry , geometry , float , float , float , float ) IS 'args: geomA, pointOrigin, sizeX, sizeY, sizeZ, sizeM - Snap all points of the input geometry to a regular grid.';
			
COMMENT ON FUNCTION ST_Snap(geometry , geometry , float ) IS 'args: input, reference, tolerance - Snap segments and vertices of input geometry to vertices of a reference geometry.';
			
COMMENT ON FUNCTION ST_SwapOrdinates(geometry, cstring) IS 'args: geom, ords - Returns a version of the given geometry with given ordinate values swapped.';
			
COMMENT ON FUNCTION ST_IsValid(geometry ) IS 'args: g - Tests if a geometry is well-formed in 2D.';
			
COMMENT ON FUNCTION ST_IsValid(geometry , integer ) IS 'args: g, flags - Tests if a geometry is well-formed in 2D.';
			
COMMENT ON FUNCTION ST_IsValidDetail(geometry , integer ) IS 'args: geom, flags - Returns a valid_detail row stating if a geometry is valid, and if not a reason why and a location.';
			
COMMENT ON FUNCTION ST_IsValidReason(geometry , integer ) IS 'args: geomA, flags - Returns text stating if a geometry is valid, or a reason for invalidity.';
			
COMMENT ON FUNCTION ST_IsValidReason(geometry ) IS 'args: geomA - Returns text stating if a geometry is valid, or a reason for invalidity.';
			
COMMENT ON FUNCTION ST_SetSRID(geometry , integer ) IS 'args: geom, srid - Set the SRID on a geometry to a particular integer value.';
			
COMMENT ON FUNCTION ST_SRID(geometry ) IS 'args: g1 - Returns the spatial reference identifier for the ST_Geometry as defined in spatial_ref_sys table.';
			
COMMENT ON FUNCTION ST_Transform(geometry , integer ) IS 'args: g1, srid - Return a new geometry with its coordinates transformed to a different spatial reference system.';
			
COMMENT ON FUNCTION ST_Transform(geometry , text ) IS 'args: geom, to_proj - Return a new geometry with its coordinates transformed to a different spatial reference system.';
			
COMMENT ON FUNCTION ST_Transform(geometry , text , text ) IS 'args: geom, from_proj, to_proj - Return a new geometry with its coordinates transformed to a different spatial reference system.';
			
COMMENT ON FUNCTION ST_Transform(geometry , text , integer ) IS 'args: geom, from_proj, to_srid - Return a new geometry with its coordinates transformed to a different spatial reference system.';
			
COMMENT ON FUNCTION ST_Area(geometry ) IS 'args: g1 - Returns the area of a polygonal geometry.';
			
COMMENT ON FUNCTION ST_Area(geography , boolean ) IS 'args: geog, use_spheroid=true - Returns the area of a polygonal geometry.';
			
COMMENT ON FUNCTION ST_Azimuth(geometry , geometry ) IS 'args: pointA, pointB - Returns the north-based azimuth as the angle in radians measured clockwise from the vertical on pointA to pointB.';
			
COMMENT ON FUNCTION ST_Azimuth(geography , geography ) IS 'args: pointA, pointB - Returns the north-based azimuth as the angle in radians measured clockwise from the vertical on pointA to pointB.';
			
COMMENT ON FUNCTION ST_Angle(geometry , geometry , geometry , geometry ) IS 'args: point1, point2, point3, point4 - Returns the angle between 3 points, or between 2 vectors (4 points or 2 lines).';
			
COMMENT ON FUNCTION ST_Angle(geometry , geometry ) IS 'args: line1, line2 - Returns the angle between 3 points, or between 2 vectors (4 points or 2 lines).';
			
COMMENT ON FUNCTION ST_ClosestPoint(geometry , geometry ) IS 'args: g1, g2 - Returns the 2D point on g1 that is closest to g2. This is the first point of the shortest line.';
			
COMMENT ON FUNCTION ST_3DClosestPoint(geometry , geometry ) IS 'args: g1, g2 - Returns the 3D point on g1 that is closest to g2. This is the first point of the 3D shortest line.';
			
COMMENT ON FUNCTION ST_Distance(geometry , geometry ) IS 'args: g1, g2 - Returns the distance between two geometry or geography values.';
			
COMMENT ON FUNCTION ST_Distance(geography , geography , boolean ) IS 'args: geog1, geog2, use_spheroid=true - Returns the distance between two geometry or geography values.';
			
COMMENT ON FUNCTION ST_3DDistance(geometry , geometry ) IS 'args: g1, g2 - Returns the 3D cartesian minimum distance (based on spatial ref) between two geometries in projected units.';
			
COMMENT ON FUNCTION ST_DistanceSphere(geometry , geometry ) IS 'args: geomlonlatA, geomlonlatB - Returns minimum distance in meters between two lon/lat geometries using a spherical earth model.';
			
COMMENT ON FUNCTION ST_DistanceSpheroid(geometry , geometry , spheroid ) IS 'args: geomlonlatA, geomlonlatB, measurement_spheroid - Returns the minimum distance between two lon/lat geometries using a spheroidal earth model.';
			
COMMENT ON FUNCTION ST_FrechetDistance(geometry , geometry , float) IS 'args: g1, g2, densifyFrac = -1 - Returns the Fréchet distance between two geometries.';
			
COMMENT ON FUNCTION ST_HausdorffDistance(geometry , geometry ) IS 'args: g1, g2 - Returns the Hausdorff distance between two geometries.';
			
COMMENT ON FUNCTION ST_HausdorffDistance(geometry , geometry , float) IS 'args: g1, g2, densifyFrac - Returns the Hausdorff distance between two geometries.';
			
COMMENT ON FUNCTION ST_Length(geometry ) IS 'args: a_2dlinestring - Returns the 2D length of a linear geometry.';
			
COMMENT ON FUNCTION ST_Length(geography , boolean ) IS 'args: geog, use_spheroid=true - Returns the 2D length of a linear geometry.';
			
COMMENT ON FUNCTION ST_Length2D(geometry ) IS 'args: a_2dlinestring - Returns the 2D length of a linear geometry. Alias for ST_Length';
			
COMMENT ON FUNCTION ST_3DLength(geometry ) IS 'args: a_3dlinestring - Returns the 3D length of a linear geometry.';
			
COMMENT ON FUNCTION ST_LengthSpheroid(geometry , spheroid ) IS 'args: a_geometry, a_spheroid - Returns the 2D or 3D length/perimeter of a lon/lat geometry on a spheroid.';
			
COMMENT ON FUNCTION ST_LongestLine(geometry , geometry ) IS 'args: g1, g2 - Returns the 2D longest line between two geometries.';
			
COMMENT ON FUNCTION ST_3DLongestLine(geometry , geometry ) IS 'args: g1, g2 - Returns the 3D longest line between two geometries';
			
COMMENT ON FUNCTION ST_MaxDistance(geometry , geometry ) IS 'args: g1, g2 - Returns the 2D largest distance between two geometries in projected units.';
			
COMMENT ON FUNCTION ST_3DMaxDistance(geometry , geometry ) IS 'args: g1, g2 - Returns the 3D cartesian maximum distance (based on spatial ref) between two geometries in projected units.';
			
COMMENT ON FUNCTION ST_MinimumClearance(geometry ) IS 'args: g - Returns the minimum clearance of a geometry, a measure of a geometrys robustness.';
			
COMMENT ON FUNCTION ST_MinimumClearanceLine(geometry ) IS 'args: g - Returns the two-point LineString spanning a geometrys minimum clearance.';
			
COMMENT ON FUNCTION ST_Perimeter(geometry ) IS 'args: g1 - Returns the length of the boundary of a polygonal geometry or geography.';
			
COMMENT ON FUNCTION ST_Perimeter(geography , boolean ) IS 'args: geog, use_spheroid=true - Returns the length of the boundary of a polygonal geometry or geography.';
			
COMMENT ON FUNCTION ST_Perimeter2D(geometry ) IS 'args: geomA - Returns the 2D perimeter of a polygonal geometry. Alias for ST_Perimeter.';
			
COMMENT ON FUNCTION ST_3DPerimeter(geometry ) IS 'args: geomA - Returns the 3D perimeter of a polygonal geometry.';
			
COMMENT ON FUNCTION ST_Project(geography , float , float ) IS 'args: g1, distance, azimuth - Returns a point projected from a start point by a distance and bearing (azimuth).';
			
COMMENT ON FUNCTION ST_ShortestLine(geometry , geometry ) IS 'args: g1, g2 - Returns the 2D shortest line between two geometries';
			
COMMENT ON FUNCTION ST_3DShortestLine(geometry , geometry ) IS 'args: g1, g2 - Returns the 3D shortest line between two geometries';
			
COMMENT ON FUNCTION ST_Buffer(geometry , float , text ) IS 'args: g1, radius_of_buffer, buffer_style_parameters='' - (T)Returns a geometry covering all points within a given distancefrom the input geometry.';
			
COMMENT ON FUNCTION ST_Buffer(geometry , float , integer ) IS 'args: g1, radius_of_buffer, num_seg_quarter_circle - (T)Returns a geometry covering all points within a given distancefrom the input geometry.';
			
COMMENT ON FUNCTION ST_Buffer(geography , float , text ) IS 'args: g1, radius_of_buffer, buffer_style_parameters - (T)Returns a geometry covering all points within a given distancefrom the input geometry.';
			
COMMENT ON FUNCTION ST_Buffer(geography , float , integer ) IS 'args: g1, radius_of_buffer, num_seg_quarter_circle - (T)Returns a geometry covering all points within a given distancefrom the input geometry.';
			
COMMENT ON FUNCTION ST_BuildArea(geometry ) IS 'args: A - Creates an areal geometry formed by the constituent linework of given geometry';
			
COMMENT ON FUNCTION ST_Centroid(geometry ) IS 'args: g1 - Returns the geometric center of a geometry.';
			
COMMENT ON FUNCTION ST_Centroid(geography , boolean ) IS 'args: g1, use_spheroid=true - Returns the geometric center of a geometry.';
			
COMMENT ON FUNCTION ST_ClipByBox2D(geometry, box2d) IS 'args: geom, box - Returns the portion of a geometry falling within a rectangle.';
			
COMMENT ON FUNCTION ST_ConcaveHull(geometry , float , boolean ) IS 'args: geomA, target_percent, allow_holes=false - The concave hull of a geometry represents a possibly concave geometry that encloses all geometries within the set. You can think of it as shrink wrapping.';
			
COMMENT ON FUNCTION ST_ConvexHull(geometry ) IS 'args: geomA - Computes the convex hull of a geometry.';
			
COMMENT ON FUNCTION ST_CurveToLine(geometry, float, integer, integer) IS 'args: curveGeom, tolerance, tolerance_type, flags - Converts a CIRCULARSTRING/CURVEPOLYGON/MULTISURFACE to a LINESTRING/POLYGON/MULTIPOLYGON';
			
COMMENT ON FUNCTION ST_DelaunayTriangles(geometry , float , int4 ) IS 'args: g1, tolerance, flags - Return a Delaunay triangulation around the given input points.';
			
COMMENT ON FUNCTION ST_Difference(geometry , geometry ) IS 'args: geomA, geomB - Returns a geometry that represents that part of geometry A that does not intersect with geometry B.';
			
COMMENT ON FUNCTION ST_FlipCoordinates(geometry) IS 'args: geom - Returns a version of the given geometry with X and Y axis flipped. Useful for people who have built latitude/longitude features and need to fix them.';
			
COMMENT ON FUNCTION ST_GeneratePoints(geometry, integer) IS 'args: g, npoints - Converts a polygon or multi-polygon into a multi-point composed of randomly location points within the original areas.';
			
COMMENT ON FUNCTION ST_GeneratePoints(geometry, integer, integer) IS 'args: g, npoints, seed - Converts a polygon or multi-polygon into a multi-point composed of randomly location points within the original areas.';
			
COMMENT ON FUNCTION 
					ST_GeometricMedian
				(
					geometry
				, 
					float8
				, 
					int
				, 
					boolean
				) IS 'args: 
					g
				, 
					tolerance
				, 
					max_iter
				, 
					fail_if_not_converged
				 - Returns the geometric median of a MultiPoint.';
			
COMMENT ON FUNCTION ST_Intersection(geometry, geometry) IS 'args: geomA, geomB - (T)Returns a geometry that represents the shared portion of geomA and geomB.';
			
COMMENT ON FUNCTION ST_Intersection(geography, geography) IS 'args: geogA, geogB - (T)Returns a geometry that represents the shared portion of geomA and geomB.';
			
COMMENT ON FUNCTION ST_LineToCurve(geometry ) IS 'args: geomANoncircular - Converts a LINESTRING/POLYGON to a CIRCULARSTRING, CURVEPOLYGON';
			
COMMENT ON FUNCTION ST_MakeValid(geometry) IS 'args: input - Attempts to make an invalid geometry valid without losing vertices.';
			
COMMENT ON AGGREGATE ST_MemUnion(geometry) IS 'args: geomfield - Same as ST_Union, only memory-friendly (uses less memory and more processor time).';
			
COMMENT ON FUNCTION ST_MinimumBoundingCircle(geometry , integer ) IS 'args: geomA, num_segs_per_qt_circ=48 - Returns the smallest circle polygon that can fully contain a geometry. Default uses 48 segments per quarter circle.';
			
COMMENT ON FUNCTION ST_MinimumBoundingRadius(geometry) IS 'args: geom - Returns the center point and radius of the smallest circle that can fully contain a geometry.';
			
COMMENT ON FUNCTION ST_OrientedEnvelope(geometry) IS 'args: geom - Returns a minimum rotated rectangle enclosing a geometry.';
			
COMMENT ON AGGREGATE ST_Polygonize(geometry) IS 'args: geomfield - Aggregate. Creates a GeometryCollection containing possible polygons formed from the constituent linework of a set of geometries.';
			
COMMENT ON FUNCTION ST_Polygonize(geometry[]) IS 'args: geom_array - Aggregate. Creates a GeometryCollection containing possible polygons formed from the constituent linework of a set of geometries.';
			
COMMENT ON FUNCTION ST_Node(geometry ) IS 'args: geom - Node a set of linestrings.';
			
COMMENT ON FUNCTION ST_OffsetCurve(geometry , float , text ) IS 'args: line, signed_distance, style_parameters='' - Return an offset line at a given distance and side from an input line. Useful for computing parallel lines about a center line';
			
COMMENT ON FUNCTION ST_PointOnSurface(geometry ) IS 'args: g1 - Returns a POINT guaranteed to lie on the surface.';
			
COMMENT ON FUNCTION ST_RemoveRepeatedPoints(geometry, float8) IS 'args: geom, tolerance - Returns a version of the given geometry with duplicated points removed.';
			
COMMENT ON FUNCTION ST_SharedPaths(geometry, geometry) IS 'args: lineal1, lineal2 - Returns a collection containing paths shared by the two input linestrings/multilinestrings.';
			
COMMENT ON FUNCTION ST_ShiftLongitude(geometry ) IS 'args: geomA - Toggle geometry coordinates between -180..180 and 0..360 ranges.';
			
COMMENT ON FUNCTION ST_WrapX(geometry , float8 , float8 ) IS 'args: geom, wrap, move - Wrap a geometry around an X value.';
			
COMMENT ON FUNCTION ST_Simplify(geometry, float, boolean) IS 'args: geomA, tolerance, preserveCollapsed - Returns a "simplified" version of the given geometry using the Douglas-Peucker algorithm.';
			
COMMENT ON FUNCTION ST_SimplifyPreserveTopology(geometry, float) IS 'args: geomA, tolerance - Returns a "simplified" version of the given geometry using the Douglas-Peucker algorithm. Will avoid creating derived geometries (polygons in particular) that are invalid.';
			
COMMENT ON FUNCTION ST_SimplifyVW(geometry, float) IS 'args: geomA, tolerance - Returns a "simplified" version of the given geometry using the Visvalingam-Whyatt algorithm';
			
COMMENT ON FUNCTION ST_ChaikinSmoothing(geometry, integer, boolean) IS 'args: geom, nIterations = 1, preserveEndPoints = false - Returns a "smoothed" version of the given geometry using the Chaikin algorithm';
			
COMMENT ON FUNCTION ST_FilterByM(geometry, double precision, double precision, boolean) IS 'args: geom, min, max = null, returnM = false - Filters vertex points based on their m-value';
			
COMMENT ON FUNCTION ST_SetEffectiveArea(geometry, float, integer) IS 'args: geomA, threshold = 0, set_area = 1 - Sets the effective area for each vertex, storing the value in the M ordinate. A simplified geometry can then be generated by filtering on the M ordinate.';
			
COMMENT ON FUNCTION ST_Split(geometry, geometry) IS 'args: input, blade - Returns a collection of geometries resulting by splitting a geometry.';
			
COMMENT ON FUNCTION ST_SymDifference(geometry , geometry ) IS 'args: geomA, geomB - Returns a geometry that represents the portions of A and B that do not intersect. It is called a symmetric difference because ST_SymDifference(A,B) = ST_SymDifference(B,A).';
			
COMMENT ON FUNCTION ST_Subdivide(geometry, integer) IS 'args: geom, max_vertices=256 - Returns a set of geometry where no geometry in the set has more than the specified number of vertices.';
			
COMMENT ON AGGREGATE ST_Union(geometry) IS 'args: g1field - Returns a geometry that represents the point set union of the Geometries.';
			
COMMENT ON FUNCTION ST_Union(geometry, geometry) IS 'args: g1, g2 - Returns a geometry that represents the point set union of the Geometries.';
			
COMMENT ON FUNCTION ST_Union(geometry[]) IS 'args: g1_array - Returns a geometry that represents the point set union of the Geometries.';
			
COMMENT ON FUNCTION ST_UnaryUnion(geometry ) IS 'args: geom - Like ST_Union, but working at the geometry component level.';
			
COMMENT ON FUNCTION ST_VoronoiLines(geometry, float8, geometry) IS 'args: g1, tolerance, extend_to - Returns the boundaries between the cells of the Voronoi diagram constructed from the vertices of a geometry.';
			
COMMENT ON FUNCTION ST_VoronoiPolygons(geometry, float8, geometry) IS 'args: g1, tolerance, extend_to - Returns the cells of the Voronoi diagram constructed from the vertices of a geometry.';
			
COMMENT ON FUNCTION ST_Affine(geometry , float , float , float , float , float , float , float , float , float , float , float , float ) IS 'args: geomA, a, b, c, d, e, f, g, h, i, xoff, yoff, zoff - Apply a 3D affine transformation to a geometry.';
			
COMMENT ON FUNCTION ST_Affine(geometry , float , float , float , float , float , float ) IS 'args: geomA, a, b, d, e, xoff, yoff - Apply a 3D affine transformation to a geometry.';
			
COMMENT ON FUNCTION ST_Rotate(geometry, float) IS 'args: geomA, rotRadians - Rotates a geometry about an origin point.';
			
COMMENT ON FUNCTION ST_Rotate(geometry, float, float, float) IS 'args: geomA, rotRadians, x0, y0 - Rotates a geometry about an origin point.';
			
COMMENT ON FUNCTION ST_Rotate(geometry, float, geometry) IS 'args: geomA, rotRadians, pointOrigin - Rotates a geometry about an origin point.';
			
COMMENT ON FUNCTION ST_RotateX(geometry, float) IS 'args: geomA, rotRadians - Rotates a geometry about the X axis.';
			
COMMENT ON FUNCTION ST_RotateY(geometry, float) IS 'args: geomA, rotRadians - Rotates a geometry about the Y axis.';
			
COMMENT ON FUNCTION ST_RotateZ(geometry, float) IS 'args: geomA, rotRadians - Rotates a geometry about the Z axis.';
			
COMMENT ON FUNCTION ST_Scale(geometry , float, float, float) IS 'args: geomA, XFactor, YFactor, ZFactor - Scales a geometry by given factors.';
			
COMMENT ON FUNCTION ST_Scale(geometry , float, float) IS 'args: geomA, XFactor, YFactor - Scales a geometry by given factors.';
			
COMMENT ON FUNCTION ST_Scale(geometry , geometry) IS 'args: geom, factor - Scales a geometry by given factors.';
			
COMMENT ON FUNCTION ST_Scale(geometry , geometry, geometry) IS 'args: geom, factor, origin - Scales a geometry by given factors.';
			
COMMENT ON FUNCTION ST_Translate(geometry , float , float ) IS 'args: g1, deltax, deltay - Translates a geometry by given offsets.';
			
COMMENT ON FUNCTION ST_Translate(geometry , float , float , float ) IS 'args: g1, deltax, deltay, deltaz - Translates a geometry by given offsets.';
			
COMMENT ON FUNCTION ST_TransScale(geometry , float, float, float, float) IS 'args: geomA, deltaX, deltaY, XFactor, YFactor - Translates and scales a geometry by given offsets and factors.';
			
COMMENT ON FUNCTION ST_ClusterDBSCAN(geometry, float8 , integer ) IS 'args: geom, eps, minpoints - Window function that returns a cluster id for each input geometry using the DBSCAN algorithm.';
			
COMMENT ON AGGREGATE ST_ClusterIntersecting(geometry) IS 'args: g - Aggregate function that clusters the input geometries into connected sets.';
			
COMMENT ON FUNCTION ST_ClusterKMeans(geometry, integer ) IS 'args: geom, number_of_clusters - Window function that returns a cluster id for each input geometry using the K-means algorithm.';
			
COMMENT ON AGGREGATE ST_ClusterWithin(geometry, float8 ) IS 'args: g, distance - Aggregate function that clusters the input geometries by separation distance.';
			
COMMENT ON FUNCTION Box2D(geometry ) IS 'args: geomA - Returns a BOX2D representing the 2D extent of the geometry.';
			
COMMENT ON FUNCTION Box3D(geometry ) IS 'args: geomA - Returns a BOX3D representing the 3D extent of the geometry.';
			
COMMENT ON FUNCTION ST_EstimatedExtent(text , text , text , boolean ) IS 'args: schema_name, table_name, geocolumn_name, parent_only - Return the estimated extent of a spatial table.';
			
COMMENT ON FUNCTION ST_EstimatedExtent(text , text , text ) IS 'args: schema_name, table_name, geocolumn_name - Return the estimated extent of a spatial table.';
			
COMMENT ON FUNCTION ST_EstimatedExtent(text , text ) IS 'args: table_name, geocolumn_name - Return the estimated extent of a spatial table.';
			
COMMENT ON FUNCTION ST_Expand(geometry , float) IS 'args: geom, units_to_expand - Returns a bounding box expanded from another bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_Expand(geometry , float, float, float, float) IS 'args: geom, dx, dy, dz=0, dm=0 - Returns a bounding box expanded from another bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_Expand(box2d , float) IS 'args: box, units_to_expand - Returns a bounding box expanded from another bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_Expand(box2d , float, float) IS 'args: box, dx, dy - Returns a bounding box expanded from another bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_Expand(box3d , float) IS 'args: box, units_to_expand - Returns a bounding box expanded from another bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_Expand(box3d , float, float, float) IS 'args: box, dx, dy, dz=0 - Returns a bounding box expanded from another bounding box or a geometry.';
			
COMMENT ON AGGREGATE ST_Extent(geometry) IS 'args: geomfield - an aggregate function that returns the bounding box that bounds rows of geometries.';
			
COMMENT ON AGGREGATE ST_3DExtent(geometry) IS 'args: geomfield - an aggregate function that returns the 3D bounding box that bounds rows of geometries.';
			
COMMENT ON FUNCTION ST_MakeBox2D(geometry , geometry ) IS 'args: pointLowLeft, pointUpRight - Creates a BOX2D defined by two 2D point geometries.';
			
COMMENT ON FUNCTION ST_3DMakeBox(geometry , geometry ) IS 'args: point3DLowLeftBottom, point3DUpRightTop - Creates a BOX3D defined by two 3D point geometries.';
			
COMMENT ON FUNCTION ST_XMax(box3d ) IS 'args: aGeomorBox2DorBox3D - Returns the X maxima of a 2D or 3D bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_XMin(box3d ) IS 'args: aGeomorBox2DorBox3D - Returns the X minima of a 2D or 3D bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_YMax(box3d ) IS 'args: aGeomorBox2DorBox3D - Returns the Y maxima of a 2D or 3D bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_YMin(box3d ) IS 'args: aGeomorBox2DorBox3D - Returns the Y minima of a 2D or 3D bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_ZMax(box3d ) IS 'args: aGeomorBox2DorBox3D - Returns the Z maxima of a 2D or 3D bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_ZMin(box3d ) IS 'args: aGeomorBox2DorBox3D - Returns the Z minima of a 2D or 3D bounding box or a geometry.';
			
COMMENT ON FUNCTION ST_LineInterpolatePoint(geometry , float8 ) IS 'args: a_linestring, a_fraction - Returns a point interpolated along a line. Second argument is a float8 between 0 and 1 representing fraction of total length of linestring the point has to be located.';
			
COMMENT ON FUNCTION ST_LineInterpolatePoint(geometry , float8 ) IS 'args: a_linestring, a_fraction - Returns a point interpolated along a line in 3D. Second argument is a float8 between 0 and 1 representing fraction of total length of linestring the point has to be located.';
			
COMMENT ON FUNCTION ST_LineInterpolatePoints(geometry , float8 , boolean ) IS 'args: a_linestring, a_fraction, repeat - Returns one or more points interpolated along a line.';
			
COMMENT ON FUNCTION ST_LineLocatePoint(geometry , geometry ) IS 'args: a_linestring, a_point - Returns a float between 0 and 1 representing the location of the closest point on LineString to the given Point, as a fraction of total 2d line length.';
			
COMMENT ON FUNCTION ST_LineSubstring(geometry , float8 , float8 ) IS 'args: a_linestring, startfraction, endfraction - Return a linestring being a substring of the input one starting and ending at the given fractions of total 2d length. Second and third arguments are float8 values between 0 and 1.';
			
COMMENT ON FUNCTION ST_LocateAlong(geometry , float8 , float8 ) IS 'args: ageom_with_measure, a_measure, offset - Return a derived geometry collection value with elements that match the specified measure. Polygonal elements are not supported.';
			
COMMENT ON FUNCTION ST_LocateBetween(geometry , float8 , float8 , float8 ) IS 'args: geom, measure_start, measure_end, offset - Return a derived geometry collection value with elements that match the specified range of measures inclusively.';
			
COMMENT ON FUNCTION ST_LocateBetweenElevations(geometry , float8 , float8 ) IS 'args: geom, elevation_start, elevation_end - Return a derived geometry (collection) value with elements that intersect the specified range of elevations inclusively.';
			
COMMENT ON FUNCTION ST_InterpolatePoint(geometry , geometry ) IS 'args: line, point - Return the value of the measure dimension of a geometry at the point closed to the provided point.';
			
COMMENT ON FUNCTION ST_AddMeasure(geometry , float8 , float8 ) IS 'args: geom_mline, measure_start, measure_end - Return a derived geometry with measure elements linearly interpolated between the start and end points.';
			
COMMENT ON FUNCTION ST_IsValidTrajectory(geometry ) IS 'args: line - Returns true if the geometry is a valid trajectory.';
			
COMMENT ON FUNCTION ST_ClosestPointOfApproach(geometry , geometry ) IS 'args: track1, track2 - Returns the measure at which points interpolated along two trajectories are closest.';
			
COMMENT ON FUNCTION ST_DistanceCPA(geometry , geometry ) IS 'args: track1, track2 - Returns the distance between the closest point of approach of two trajectories.';
			
COMMENT ON FUNCTION ST_CPAWithin(geometry , geometry , float8 ) IS 'args: track1, track2, maxdist - Returns true if the closest point of approach of two trajectoriesis within the specified distance.';
			
COMMENT ON FUNCTION AddAuth(text ) IS 'args: auth_token - Adds an authorization token to be used in the current transaction.';
			
COMMENT ON FUNCTION CheckAuth(text , text , text ) IS 'args: a_schema_name, a_table_name, a_key_column_name - Creates a trigger on a table to prevent/allow updates and deletes of rows based on authorization token.';
			
COMMENT ON FUNCTION CheckAuth(text , text ) IS 'args: a_table_name, a_key_column_name - Creates a trigger on a table to prevent/allow updates and deletes of rows based on authorization token.';
			
COMMENT ON FUNCTION DisableLongTransactions() IS 'Disables long transaction support.';
			
COMMENT ON FUNCTION EnableLongTransactions() IS 'Enables long transaction support.';
			
COMMENT ON FUNCTION LockRow(text , text , text , text, timestamp) IS 'args: a_schema_name, a_table_name, a_row_key, an_auth_token, expire_dt - Sets lock/authorization for a row in a table.';
			
COMMENT ON FUNCTION LockRow(text , text , text, timestamp) IS 'args: a_table_name, a_row_key, an_auth_token, expire_dt - Sets lock/authorization for a row in a table.';
			
COMMENT ON FUNCTION LockRow(text , text , text) IS 'args: a_table_name, a_row_key, an_auth_token - Sets lock/authorization for a row in a table.';
			
COMMENT ON FUNCTION UnlockRows(text ) IS 'args: auth_token - Removes all locks held by an authorization token.';
			
COMMENT ON FUNCTION PostGIS_Extensions_Upgrade() IS 'Packages and upgrades postgis extensions (e.g. postgis_raster,postgis_topology, postgis_sfcgal) to latest available version.';
			
COMMENT ON FUNCTION PostGIS_Full_Version() IS 'Reports full postgis version and build configuration infos.';
			
COMMENT ON FUNCTION PostGIS_GEOS_Version() IS 'Returns the version number of the GEOS library.';
			
COMMENT ON FUNCTION PostGIS_Liblwgeom_Version() IS 'Returns the version number of the liblwgeom library. This should match the version of PostGIS.';
			
COMMENT ON FUNCTION PostGIS_LibXML_Version() IS 'Returns the version number of the libxml2 library.';
			
COMMENT ON FUNCTION PostGIS_Lib_Build_Date() IS 'Returns build date of the PostGIS library.';
			
COMMENT ON FUNCTION PostGIS_Lib_Version() IS 'Returns the version number of the PostGIS library.';
			
COMMENT ON FUNCTION PostGIS_PROJ_Version() IS 'Returns the version number of the PROJ4 library.';
			
COMMENT ON FUNCTION PostGIS_Wagyu_Version() IS 'Returns the version number of the internal Wagyu library.';
			
COMMENT ON FUNCTION PostGIS_Scripts_Build_Date() IS 'Returns build date of the PostGIS scripts.';
			
COMMENT ON FUNCTION PostGIS_Scripts_Installed() IS 'Returns version of the postgis scripts installed in this database.';
			
COMMENT ON FUNCTION PostGIS_Scripts_Released() IS 'Returns the version number of the postgis.sql script released with the installed postgis lib.';
			
COMMENT ON FUNCTION PostGIS_Version() IS 'Returns PostGIS version number and compile-time options.';
			
COMMENT ON FUNCTION PostGIS_AddBBox(geometry ) IS 'args: geomA - Add bounding box to the geometry.';
			
COMMENT ON FUNCTION PostGIS_DropBBox(geometry ) IS 'args: geomA - Drop the bounding box cache from the geometry.';
			
COMMENT ON FUNCTION PostGIS_HasBBox(geometry ) IS 'args: geomA - Returns TRUE if the bbox of this geometry is cached, FALSE otherwise.';
			