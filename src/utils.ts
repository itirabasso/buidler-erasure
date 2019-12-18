import { ethers, utils } from "ethers";
import {
  ensureFileSync,
  existsSync,
  readJsonSync,
  writeJSONSync
} from "fs-extra";

export function createSelector(
  functionName: string,
  abiTypes: Array<string | ethers.utils.ParamType>
) {
  const joinedTypes = abiTypes.join(",");
  const functionSignature = `${functionName}(${joinedTypes})`;

  const selector = utils.hexDataSlice(
    utils.keccak256(utils.toUtf8Bytes(functionSignature)),
    0,
    4
  );
  return selector;
}

/**
 * This function reflects the usage of abi.encodeWithSelector in Solidity.
 * It prepends the selector to the ABI-encoded values.
 *
 * @param {string} functionName
 * @param {Array<string>} abiTypes
 * @param {Array<any>} abiValues
 */
export function abiEncodeWithSelector(
  functionName: string,
  abiTypes: Array<string | ethers.utils.ParamType>,
  abiValues: any[]
) {
  const abiEncoder = new ethers.utils.AbiCoder();
  const initData = abiEncoder.encode(abiTypes, abiValues);
  const selector = createSelector(functionName, abiTypes);
  const encoded = selector + initData.slice(2);
  return encoded;
}

// TODO : this can be placed into the buidler's config.
const stateFilename = "state.json";

export const readState = (): any => readJsonSync(stateFilename);

export const writeState = (state: any): any =>
  writeJSONSync(stateFilename, state);

export const setInitialState = () => writeState({});

export const ensureStateFile = () => {
  if (!existsSync(stateFilename)) {
    ensureFileSync(stateFilename);
    setInitialState();
  }
};
