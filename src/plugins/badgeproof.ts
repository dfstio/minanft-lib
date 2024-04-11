export {
  BadgeData,
  BadgeDataWitness,
  MinaNFTBadgeCalculation,
  MinaNFTBadgeProof,
};

import { Field, ZkProgram, Struct } from "o1js";
import { Metadata, MetadataWitness } from "../contract/metadata";

class BadgeDataWitness extends Struct({
  root: Metadata,
  value: Metadata,
  key: Field,
  witness: MetadataWitness,
}) {}

class BadgeData extends Struct({
  root: Metadata,
  data: Metadata,
  key: Field,
}) {
  // TODO: remove comments from key validation after https://github.com/o1-labs/o1js/issues/1552

  static create(badgeDataWitness: BadgeDataWitness) {
    const [dataWitnessRootBefore, dataWitnessKey] =
      badgeDataWitness.witness.data.computeRootAndKey(
        badgeDataWitness.value.data
      );
    badgeDataWitness.root.data.assertEquals(dataWitnessRootBefore);
    //dataWitnessKey.assertEquals(badgeDataWitness.key);

    const [kindWitnessRootBefore, kindWitnessKey] =
      badgeDataWitness.witness.kind.computeRootAndKey(
        badgeDataWitness.value.kind
      );
    badgeDataWitness.root.kind.assertEquals(kindWitnessRootBefore);
    //kindWitnessKey.assertEquals(badgeDataWitness.key);

    return new BadgeData({
      root: badgeDataWitness.root,
      data: badgeDataWitness.value,
      key: badgeDataWitness.key,
    });
  }

  static assertEquals(data1: BadgeData, data2: BadgeData) {
    Metadata.assertEquals(data1.root, data2.root);
    Metadata.assertEquals(data1.data, data2.data);
    data1.key.assertEquals(data2.key);
  }
}

const MinaNFTBadgeCalculation = ZkProgram({
  name: "MinaNFTBadgeCalculation",
  publicInput: BadgeData,

  methods: {
    create: {
      privateInputs: [BadgeDataWitness],

      async method(state: BadgeData, badgeDataWitness: BadgeDataWitness) {
        const computedState = BadgeData.create(badgeDataWitness);
        BadgeData.assertEquals(computedState, state);
      },
    },
  },
});

class MinaNFTBadgeProof extends ZkProgram.Proof(MinaNFTBadgeCalculation) {}
