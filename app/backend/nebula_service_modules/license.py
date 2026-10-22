class LicenseService:
    """License listing, device-identifier, and license-install methods."""

    @staticmethod
    def _iso_or_none(msg, field_name):
        """ISO-8601 UTC string for a Timestamp field, or None if unset (never expires)."""
        if not msg.HasField(field_name):
            return None
        return getattr(msg, field_name).ToDatetime().isoformat() + "Z"

    def _serialize_service_license(self, license_pb2, service_license):
        return {
            "service": license_pb2.LicensedService.Name(service_license.service),
            "state": license_pb2.LicenseState.Name(service_license.state),
            "name": service_license.name,
            "displayName": service_license.display_name,
            "grpcService": service_license.grpc_service,
            "detail": service_license.detail,
            "expires": self._iso_or_none(service_license, "expires"),
            "licenseId": service_license.license_id,
        }

    def _serialize_installed_license(self, license_pb2, installed_license):
        return {
            "licenseId": installed_license.license_id,
            "customer": installed_license.customer,
            "issued": self._iso_or_none(installed_license, "issued"),
            "expires": self._iso_or_none(installed_license, "expires"),
            "services": [license_pb2.LicensedService.Name(v) for v in installed_license.services],
            "hardwareVerified": installed_license.hardware_verified,
            "notes": installed_license.notes,
        }

    def list_licenses(self):
        """List every licensable service's state and every license installed on this computer."""
        license_pb2 = self._get_module("flexiv.pdk.license.license_service_pb2")
        with self._create_client() as client:
            response = client.license.stub.List(license_pb2.ListRequest())
        code, msg = self._check_status(response, "List licenses")
        return {
            "status": {"code": code, "message": msg},
            "services": [self._serialize_service_license(license_pb2, s) for s in response.services],
            "licenses": [self._serialize_installed_license(license_pb2, l) for l in response.licenses],
            "tpmAvailable": response.tpm_available,
            "tpmDetail": response.tpm_detail,
            "licenseDirectory": response.license_directory,
            "warnings": list(response.warnings),
        }

    def get_device_identifier(self):
        """Return this computer's identifier to send to Flexiv when requesting a license."""
        license_pb2 = self._get_module("flexiv.pdk.license.license_service_pb2")
        with self._create_client() as client:
            response = client.license.stub.GetDeviceIdentifier(license_pb2.GetDeviceIdentifierRequest())
        code, msg = self._check_status(response, "Get device identifier")
        return {
            "status": {"code": code, "message": msg},
            "identifier": response.identifier,
            "hardwareVerifiable": response.hardware_verifiable,
        }

    def save_license(self, license_b64, file_name=""):
        """Install a license file's raw bytes (base64-encoded for transport).

        Mirrors the CLI's `LicenseServiceClient.install_file`: the raw bytes
        may be either a `.lic` bundle or its already-base64 text form, and
        `license_file.license_text` (the same helper the CLI uses) tells the
        two apart and returns what `SaveRequest.license` expects.
        """
        import base64

        license_file = self._get_module("flexiv.pdk.license.license_file")
        license_pb2 = self._get_module("flexiv.pdk.license.license_service_pb2")

        raw = base64.b64decode(license_b64)
        license_value = license_file.license_text(raw)
        safe_file_name = license_file.server_file_name(file_name) if file_name else ""

        with self._create_client() as client:
            response = client.license.stub.Save(
                license_pb2.SaveRequest(license=license_value, file_name=safe_file_name)
            )
        code, msg = self._check_status(response, "Install license")
        return {
            "status": {"code": code, "message": msg},
            "services": [self._serialize_service_license(license_pb2, s) for s in response.services],
            "newlyLicensed": [license_pb2.LicensedService.Name(v) for v in response.newly_licensed],
            "filePath": response.file_path,
        }
