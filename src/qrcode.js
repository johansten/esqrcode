/*
   Copyright 2011 Lazar Laszlo (lazarsoft@gmail.com, www.lazarsoft.info)

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


import {Detector} from './detector.js';
import Decoder from './decoder.js';

const qrcode = {};
qrcode.imagedata = null;
qrcode.width = 0;
qrcode.height = 0;
qrcode.qrCodeSymbol = null;
qrcode.debug = false;
qrcode.maxImgSize = 1024 * 1024;

qrcode.sizeOfDataLengthInfo = [
	[ 10, 9, 8, 8 ],
	[ 12, 11, 16, 10 ],
	[ 14, 13, 16, 12 ]
];

qrcode.callback = null;

qrcode.decode = function (src) {

	if (arguments.length === 0) {
		const canvas_qr = document.getElementById("qr-canvas");
		const context = canvas_qr.getContext('2d');
		qrcode.width = canvas_qr.width;
		qrcode.height = canvas_qr.height;
		qrcode.imagedata = context.getImageData(0, 0, qrcode.width, qrcode.height);
		qrcode.result = qrcode.process(context);

		if (qrcode.callback != null) {
			qrcode.callback(qrcode.result);
		}
		return qrcode.result;
	}

	else {
		const image = new Image();
		image.onload = function () {
			//var canvas_qr = document.getElementById("qr-canvas");
			const canvas_qr = document.createElement('canvas');
			const context = canvas_qr.getContext('2d');
			let nheight = image.height;
			let nwidth = image.width;
			if (image.width * image.height > qrcode.maxImgSize) {
				const ir = image.width / image.height;
				nheight = Math.sqrt(qrcode.maxImgSize/ir);
				nwidth=ir*nheight;
			}

			canvas_qr.width = nwidth;
			canvas_qr.height = nheight;

			context.drawImage(image, 0, 0, canvas_qr.width, canvas_qr.height );
			qrcode.width = canvas_qr.width;
			qrcode.height = canvas_qr.height;
			try {
				qrcode.imagedata = context.getImageData(0, 0, canvas_qr.width, canvas_qr.height);
			} catch (e) {
				qrcode.result = "Cross domain image reading not supported in your browser! Save it to your computer then drag and drop the file!";
				if(qrcode.callback!=null)
					qrcode.callback(qrcode.result);
				return;
			}

			try {
				qrcode.result = qrcode.process(context);
			} catch(e) {
				console.log(e);
				qrcode.result = "error decoding QR Code";
			}

			if(qrcode.callback!=null) {
				qrcode.callback(qrcode.result);
			}
		};
		image.src = src;
	}
};

qrcode.isUrl = function (s) {
	const regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
	return regexp.test(s);
};

qrcode.decode_url = function (s) {

	let escaped = '';
	try {
		escaped = escape( );
	} catch(e) {
		console.log(e);
		escaped = s;
	}

	let ret = '';
	try{
		ret = decodeURIComponent( escaped );
	} catch(e) {
		console.log(e);
		ret = escaped;
	}
	return ret;
};

qrcode.decode_utf8 = function (s) {
	if (qrcode.isUrl(s)) {
		return qrcode.decode_url(s);
	} else {
		return s;
	}
};

qrcode.process = function (ctx) {

	const start = new Date().getTime();
	const image = qrcode.grayScaleToBitmap(qrcode.grayscale());

	const detector = new Detector(image);

	const qRCodeMatrix = detector.detect();

	if (qrcode.debug) {
		ctx.putImageData(qrcode.imagedata, 0, 0);
	}

	const reader = Decoder.decode(qRCodeMatrix.bits);
	const data = reader.DataByte;
	let str = '';
	for (let i = 0; i < data.length; i++) {
		for (let j = 0;j < data[i].length; j++) {
			str += String.fromCharCode(data[i][j]);
		}
	}

	const end = new Date().getTime();
	const time = end - start;
	console.log(time);

	return qrcode.decode_utf8(str);
	//alert("Time:" + time + " Code: "+str);
};

qrcode.getPixel = function (x, y) {
	const point = (x * 4) + (y * qrcode.width * 4);
	return (qrcode.imagedata.data[point]*33 + qrcode.imagedata.data[point + 1]*34 + qrcode.imagedata.data[point + 2]*33)/100;
};

qrcode.binarize = function (th) {
	const ret = new Array(qrcode.width * qrcode.height);
	for (let y = 0; y < qrcode.height; y++) {
		for (let x = 0; x < qrcode.width; x++) {
			const gray = qrcode.getPixel(x, y);
			ret[x+y*qrcode.width] = (gray <= th)? true : false;
		}
	}
	return ret;
};

qrcode.getMiddleBrightnessPerArea = function (image) {
	const numSqrtArea = 4;
	//obtain middle brightness((min + max) / 2) per area
	const areaWidth = Math.floor(qrcode.width / numSqrtArea);
	const areaHeight = Math.floor(qrcode.height / numSqrtArea);
	const minmax = new Array(numSqrtArea);
	for (let i = 0; i < numSqrtArea; i++) {
		minmax[i] = new Array(numSqrtArea);
		for (let i2 = 0; i2 < numSqrtArea; i2++) {
			minmax[i][i2] = [0, 0];
		}
	}

	for (let ay = 0; ay < numSqrtArea; ay++) {
		for (let ax = 0; ax < numSqrtArea; ax++) {
			minmax[ax][ay][0] = 0xFF;
			for (let dy = 0; dy < areaHeight; dy++) {
				for (let dx = 0; dx < areaWidth; dx++) {
					const target = image[areaWidth * ax + dx+(areaHeight * ay + dy)*qrcode.width];
					if (target < minmax[ax][ay][0]) {
						minmax[ax][ay][0] = target;
					}
					if (target > minmax[ax][ay][1]) {
						minmax[ax][ay][1] = target;
					}
				}
			}
		}
	}

	const middle = new Array(numSqrtArea);
	for (let i3 = 0; i3 < numSqrtArea; i3++) {
		middle[i3] = new Array(numSqrtArea);
	}
	for (let ay = 0; ay < numSqrtArea; ay++) {
		for (let ax = 0; ax < numSqrtArea; ax++) {
			middle[ax][ay] = Math.floor((minmax[ax][ay][0] + minmax[ax][ay][1]) / 2);
		}
	}

	return middle;
};

qrcode.grayScaleToBitmap = function (grayScale) {
	const middle = qrcode.getMiddleBrightnessPerArea(grayScale);
	const sqrtNumArea = middle.length;
	const areaWidth = Math.floor(qrcode.width / sqrtNumArea);
	const areaHeight = Math.floor(qrcode.height / sqrtNumArea);
	const bitmap = new Array(qrcode.height * qrcode.width);

	for (let ay = 0; ay < sqrtNumArea; ay++) {
		for (let ax = 0; ax < sqrtNumArea; ax++) {
			for (let dy = 0; dy < areaHeight; dy++) {
				for (let dx = 0; dx < areaWidth; dx++) {
					bitmap[areaWidth * ax + dx+ (areaHeight * ay + dy)*qrcode.width] = (grayScale[areaWidth * ax + dx+ (areaHeight * ay + dy)*qrcode.width] < middle[ax][ay])? true : false;
				}
			}
		}
	}

	return bitmap;
};

qrcode.grayscale = function () {
	const ret = new Array(qrcode.width*qrcode.height);

	for (let y = 0; y < qrcode.height; y++) {
		for (let x = 0; x < qrcode.width; x++) {
			ret[x+y*qrcode.width] = qrcode.getPixel(x, y);
		}
	}
	return ret;
};

export default qrcode;
