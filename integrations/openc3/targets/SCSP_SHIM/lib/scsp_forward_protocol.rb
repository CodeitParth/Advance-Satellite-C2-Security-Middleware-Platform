# SCSP forward protocol — COSMOS 5 write protocol that submits each outgoing
# command packet to the SCSP security proxy (POST /api/v1/c2/forward) instead
# of writing it to the radio. Approved packets are forwarded verbatim by SCSP.
#
# Usage (plugin.txt):
#   PROTOCOL WRITE scsp_forward_protocol.rb <api_key> <source_system>
require 'openc3/interfaces/protocols/protocol'
require 'json'
require 'net/http'

module OpenC3
  class ScspForwardProtocol < Protocol
    def initialize(api_key, source_system = 'COSMOS', allow_empty_data = nil)
      super(allow_empty_data)
      @api_key = api_key
      @source_system = source_system
    end

    # Called with the raw command bytes COSMOS is about to transmit.
    # We deliver them to SCSP ourselves and stop the interface write
    # (returning :STOP) — SCSP owns the uplink from here.
    def write_data(data, extra = nil)
      uri = URI("http://#{@interface.hostname}:#{@interface.port}/api/v1/c2/forward")
      request = Net::HTTP::Post.new(uri)
      request['Content-Type'] = 'application/json'
      request['X-API-Key'] = @api_key
      request.body = JSON.generate(
        packet_hex: data.unpack1('H*').upcase,
        source_system: @source_system
      )

      response = Net::HTTP.start(uri.hostname, uri.port, read_timeout: 30) do |http|
        http.request(request)
      end
      body = JSON.parse(response.body) rescue {}

      case response.code.to_i
      when 200
        case body['disposition']
        when 'FORWARDED'
          Logger.info "SCSP: #{body['command_id']} forwarded (score #{body['risk_score']})"
        when 'PENDING_AUTHORIZATION'
          raise WriteRejectError,
                "SCSP held command for approval — id=#{body['command_id']} " \
                "score=#{body['risk_score']} (#{body['risk_tier']}). " \
                "Poll #{body['status_url']} for the decision."
        else
          raise WriteRejectError,
                "SCSP did not forward command: #{body['disposition']} — #{body['justification']}"
        end
      when 409
        raise WriteRejectError, 'SCSP blocked replay (duplicate nonce)'
      else
        error = body.dig('error', 'message') || response.body.to_s[0, 200]
        raise WriteRejectError, "SCSP rejected command (#{response.code}): #{error}"
      end

      :STOP # SCSP dispatches to the uplink; nothing leaves this interface
    end
  end

  # Raised so COSMOS surfaces the SCSP decision to the operator/script
  class WriteRejectError < StandardError; end
end
