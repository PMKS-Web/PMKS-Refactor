/*
This class verifies a string through a checksum and makes sure that
the encoded string mod len(CHECKSUM_CHARS) is equal to the last char
of the encoded string. This should work most of the time and verify that
the link is indeed from the 2023 PMKS as this is the verification method used in that.
*/

export class Checksum{
  //only characters allowed in the checksum
  static readonly CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  //verifies that the checksum matches what it is expected to be
  verifyChecksum(length:number, checksum: string): boolean{
    let i = length % Checksum.CHECKSUM_CHARS.length;
    return Checksum.CHECKSUM_CHARS[i] === checksum;
  }
}
