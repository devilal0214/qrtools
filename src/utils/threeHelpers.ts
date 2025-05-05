import * as THREE from 'three';

export const createSphereGeometry = () => {
  return new THREE.SphereGeometry(500, 60, 40);
};

export const createHotspotGeometry = () => {
  return new THREE.CircleGeometry(10, 32);
};
