/*
  Ported to JavaScript by Lazar Laszlo 2011

  lazarsoft@gmail.com, www.lazarsoft.info

*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import BitMatrixParser from './bmparser.js';
import DataBlock from './datablock.js';
import ReedSolomonDecoder from './rsdecoder.js';
import QRCodeDataBlockReader from './databr.js';
import GF256 from './gf256.js';

const Decoder = {};
Decoder.rsDecoder = new ReedSolomonDecoder(GF256.QR_CODE_FIELD);

Decoder.correctErrors = function (codewordBytes, numDataCodewords) {
	const numCodewords = codewordBytes.length;
	// First read into an array of ints
	const codewordsInts = new Array(numCodewords);
	for (let i = 0; i < numCodewords; i++) {
		codewordsInts[i] = codewordBytes[i] & 0xFF;
	}
	const numECCodewords = codewordBytes.length - numDataCodewords;
	try {
		Decoder.rsDecoder.decode(codewordsInts, numECCodewords);
		//var corrector = new ReedSolomon(codewordsInts, numECCodewords);
		//corrector.correct();
	}
	catch (rse) {
		throw rse;
	}
	// Copy back into array of bytes -- only need to worry about the bytes that were data
	// We don't care about errors in the error-correction codewords
	for (let i = 0; i < numDataCodewords; i++) {
		codewordBytes[i] =  codewordsInts[i];
	}
};

Decoder.decode = function (bits) {
	const parser = new BitMatrixParser(bits);
	const version = parser.readVersion();
	const ecLevel = parser.readFormatInformation().ErrorCorrectionLevel;

	// Read codewords
	const codewords = parser.readCodewords();

	// Separate into data blocks
	const dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel);

	// Count total number of data bytes
	let totalBytes = 0;
	for (let i = 0; i < dataBlocks.length; i++) {
		totalBytes += dataBlocks[i].NumDataCodewords;
	}

	const resultBytes = new Array(totalBytes);
	let resultOffset = 0;

	// Error-correct and copy data blocks together into a stream of bytes
	for (let j = 0; j < dataBlocks.length; j++) {
		const dataBlock = dataBlocks[j];
		const codewordBytes = dataBlock.Codewords;
		const numDataCodewords = dataBlock.NumDataCodewords;
		Decoder.correctErrors(codewordBytes, numDataCodewords);
		for (let i = 0; i < numDataCodewords; i++) {
			resultBytes[resultOffset++] = codewordBytes[i];
		}
	}

	// Decode the contents of that stream of bytes
	return new QRCodeDataBlockReader(resultBytes, version.VersionNumber, ecLevel.Bits);
	//return DecodedBitStreamParser.decode(resultBytes, version, ecLevel);
};

export default Decoder;
