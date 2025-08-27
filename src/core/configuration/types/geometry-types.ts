/**
 * Geometry and Spatial Types
 * Point, bounding box, and pose estimation type definitions
 */

// Point and geometry types
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly confidence?: number;
}

// Pose estimation types
export interface Pose3DOF {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly confidence: number;
  readonly timestamp: number;
}

export interface Pose6DOF {
  readonly translation: Point3D;
  readonly rotation: {
    readonly yaw: number;
    readonly pitch: number;
    readonly roll: number;
  };
  readonly confidence: number;
  readonly timestamp: number;
  readonly rotationMatrix?: ReadonlyArray<ReadonlyArray<number>>;
}