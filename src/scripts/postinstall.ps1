mkdir protos -Force
Invoke-WebRequest https://raw.githubusercontent.com/fiskaltrust/interface-doc/master/dist/protos/IPOS.proto -OutFile protos/IPOS.proto
Invoke-WebRequest https://raw.githubusercontent.com/fiskaltrust/interface-doc/master/dist/protos/bcl.proto -OutFile protos/bcl.proto